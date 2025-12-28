import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- 1. DYNAMIC MODEL DISCOVERY (INTELLIGENCE FIRST) ---
// Fetches only valid models for this Key. Prevents guessing wrong names.
async function getWorkingModelIds(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();

    if (!data.models) {
      console.warn("⚠️ API list failed. Using safe fallback.");
      // Fallback Strategy: Pro First, then Flash
      return ["gemini-1.5-pro", "gemini-1.5-flash"];
    }

    // Filter: Only models that support "generateContent"
    const validModels = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m: any) => m.name.replace("models/", "")); // CRITICAL: Remove 'models/' prefix

    // --- SORT STRATEGY: PRO FIRST ---
    // 1. "Pro" models go to the TOP (Smarter)
    // 2. "Flash" models go to the BOTTOM (Faster/Cheaper)
    const sortedModels = validModels.sort((a: string, b: string) => {
      const aIsPro = a.includes("pro");
      const bIsPro = b.includes("pro");

      if (aIsPro && !bIsPro) return -1; // 'a' is Pro, put it first
      if (!aIsPro && bIsPro) return 1;  // 'b' is Pro, put it first
      
      // Secondary sort: If both are same type, newer versions (usually longer names or containing 'latest') first?
      // For now, keep it simple.
      return 0;
    });

    console.log("📋 Google confirmed these models exist (Priority Order):", sortedModels);
    return sortedModels;

  } catch (e) {
    console.error("⚠️ Network error listing models:", e);
    // If fetch fails, we must return a safe fallback to prevent crash
    return ["gemini-1.5-pro", "gemini-1.5-flash"];
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // 1. Fetch the CORRECT model names from Google first
    const modelList = await getWorkingModelIds(GEMINI_API_KEY!);
    
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

    // 2. THE LOOP (Dynamic Fallback)
    // We iterate through the list Google gave us.
    for (const modelName of modelList) {
        try {
            console.log(`🔄 Attempting Model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(prompt);
            textResponse = result.response.text();
            
            console.log(`✅ Success with ${modelName}!`);
            success = true;
            break; // Stop loop on success

        } catch (error: any) {
            console.warn(`⚠️ ${modelName} Failed: ${error.message.split(' ')[0]}`);
            lastError = error.message;
            // Loop automatically tries the next model in 'modelList'
        }
    }

    if (!success) {
        return NextResponse.json(
            { error: "Service busy. Please try again.", details: lastError },
            { status: 503 }
        );
    }

    // 3. Clean and Parse JSON
    const cleanJson = textResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
    
    // Extract JSON between braces just in case of extra text
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    const finalJsonString = (firstBrace !== -1 && lastBrace !== -1) 
        ? cleanJson.substring(firstBrace, lastBrace + 1)
        : cleanJson;

    const data = JSON.parse(finalJsonString);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate results", details: error.message },
      { status: 500 }
    );
  }
}
