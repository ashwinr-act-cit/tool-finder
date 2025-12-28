import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- 1. DYNAMIC MODEL DISCOVERY ---
// This prevents "404 Not Found" by asking Google for the correct names.
async function getWorkingModelIds(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();

    // Safety fallback if the API list fails
    if (!data.models) {
        console.warn("⚠️ Failed to list models. Using defaults.");
        return [ "gemini-1.5-flash", "gemini-1.5-pro" ]; 
    }

    const validModels = data.models.filter((m: any) => 
        m.supportedGenerationMethods.includes("generateContent")
    );

    // Helper to find a model ID by a keyword (e.g., "pro" or "flash")
    const find = (keyword: string) => 
        validModels.find((m: any) => m.name.includes(keyword))?.name.replace("models/", "");

    // We build a list of valid IDs found in your account
    // It prioritizes finding a "Pro" model, then a "Flash" model.
    const detectedPro = find("pro");   // e.g., gemini-1.5-pro-latest
    const detectedFlash = find("flash"); // e.g., gemini-1.5-flash-001

    // Return a clean list of models that DEFINITELY exist
    const strategies = [];
    if (detectedFlash) strategies.push(detectedFlash); // Try Flash first (faster/cheaper)
    if (detectedPro) strategies.push(detectedPro);     // Try Pro if Flash fails
    
    // Add defaults just in case discovery missed something
    if (strategies.length === 0) return ["gemini-1.5-flash", "gemini-1.5-pro"];
    
    return strategies;

  } catch (e) {
    console.warn("⚠️ Network error listing models. Using safe defaults.");
    return ["gemini-1.5-flash", "gemini-1.5-pro"];
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // 1. Get the list of VALID models for your key
    const modelList = await getWorkingModelIds(GEMINI_API_KEY!);
    console.log(`✅ Strategy: Will try these models in order: ${modelList.join(" -> ")}`);

    const prompt = `
      You are an expert software engineer.
      User is looking for: "${query}"
      List 5 to 7 best software tools.
      Return ONLY valid JSON.
      {
        "summary": "...",
        "tools": [{ "title": "...", "url": "...", "description": "...", "isFree": true, "isOfficial": true }]
      }
    `;

    let textResponse = "";
    let success = false;
    let lastError = "";

    // 2. THE LOOP (Solves the Quota/429 Error)
    // It iterates through your valid models. If one fails, it tries the next.
    for (const modelName of modelList) {
        try {
            console.log(`🔄 Attempting Model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(prompt);
            textResponse = result.response.text();
            
            console.log(`✅ Success with ${modelName}!`);
            success = true;
            break; // Stop the loop, we got our answer

        } catch (error: any) {
            console.warn(`⚠️ ${modelName} Failed: ${error.message.split(' ')[0]}`);
            lastError = error.message;
            // The loop will automatically try the next model in 'modelList'
        }
    }

    if (!success) {
        console.error("❌ All models failed.");
        return NextResponse.json(
            { error: "Service busy. Please try again.", details: lastError },
            { status: 503 }
        );
    }

    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate results", details: error.message },
      { status: 500 }
    );
  }
}
