import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- Type Definitions (replaces unsafe `any`) ---
interface GeminiModel {
  name: string;
  supportedGenerationMethods: string[];
}

interface GeminiModelListResponse {
  models?: GeminiModel[];
}

// --- Model List Cache ---
// Fetched once per server lifecycle instead of on every request
let cachedModels: string[] | null = null;

async function getWorkingModelIds(apiKey: string): Promise<string[]> {
  // Return cached result if available
  if (cachedModels) return cachedModels;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data: GeminiModelListResponse = await response.json();

    if (!data.models) {
      console.warn("⚠️ API list failed. Using safe fallback.");
      return ["gemini-1.5-pro", "gemini-1.5-flash"];
    }

    const validModels = data.models
      .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => m.name.replace("models/", ""));

    // Sort: Pro models first (smarter), Flash models second (faster)
    const sortedModels = validModels.sort((a, b) => {
      const aIsPro = a.includes("pro");
      const bIsPro = b.includes("pro");
      if (aIsPro && !bIsPro) return -1;
      if (!aIsPro && bIsPro) return 1;
      return 0;
    });

    console.log("📋 Models confirmed (priority order):", sortedModels);
    cachedModels = sortedModels;
    return cachedModels;
  } catch (e) {
    console.error("⚠️ Network error listing models:", e);
    return ["gemini-1.5-pro", "gemini-1.5-flash"];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = body;

    // --- Input Validation ---
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Prevent extremely long inputs from blowing up token usage
    if (query.trim().length === 0 || query.length > 300) {
      return NextResponse.json(
        { error: "Query must be between 1 and 300 characters" },
        { status: 400 }
      );
    }

    // Basic sanitization to reduce prompt injection risk
    const sanitizedQuery = query
      .replace(/[`"\\]/g, "")
      .trim()
      .slice(0, 300);

    const modelList = await getWorkingModelIds(GEMINI_API_KEY!);

    const prompt = `
      You are an expert software engineer.
      The user is looking for tools that help with: "${sanitizedQuery}"
      List 5 to 7 of the best software tools for this use case.
      Return ONLY valid JSON with no markdown or extra text.
      Format:
      {
        "summary": "Brief explanation of the tools category",
        "tools": [
          {
            "title": "Tool name",
            "url": "https://official-url.com",
            "description": "One sentence description",
            "isFree": true,
            "isOfficial": true
          }
        ]
      }
    `;

    let textResponse = "";
    let success = false;
    let lastError = "";

    // Try each model in priority order, stop on first success
    for (const modelName of modelList) {
      try {
        console.log(`🔄 Trying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        textResponse = result.response.text();
        console.log(`✅ Success with ${modelName}`);
        success = true;
        break;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ ${modelName} failed: ${message.split(" ")[0]}`);
        lastError = message;
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: "All models unavailable. Please try again.", details: lastError },
        { status: 503 }
      );
    }

    // Clean markdown code fences if present
    const cleanJson = textResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Extract JSON between first { and last } in case of extra text
    const firstBrace = cleanJson.indexOf("{");
    const lastBrace = cleanJson.lastIndexOf("}");
    const finalJsonString =
      firstBrace !== -1 && lastBrace !== -1
        ? cleanJson.substring(firstBrace, lastBrace + 1)
        : cleanJson;

    // --- Safe JSON Parse (was missing before — would crash on bad AI output) ---
    let data: unknown;
    try {
      data = JSON.parse(finalJsonString);
    } catch {
      console.error("❌ AI returned invalid JSON:", finalJsonString.slice(0, 200));
      return NextResponse.json(
        { error: "AI returned invalid response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ API Error:", message);
    return NextResponse.json(
      { error: "Failed to generate results", details: message },
      { status: 500 }
    );
  }
}
