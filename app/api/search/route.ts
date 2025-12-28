import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- HELPER: Find the NEWEST working models ---
async function getModelIds(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();

    // 1. If API fails, use the NEW STANDARD defaults (Gemini 2.5)
    if (!data.models) {
        console.warn("⚠️ Failed to list models. Using Gemini 2.5 defaults.");
        return { pro: "gemini-2.5-pro", flash: "gemini-2.5-flash" }; 
    }

    const validModels = data.models.filter((m: any) => 
        m.supportedGenerationMethods.includes("generateContent")
    );

    // 2. SEARCH STRATEGY: Look for 2.5 -> 2.0 -> 1.5
    // We want the newest version available to your key.
    
    // Helper to find model by partial name
    const find = (str: string) => validModels.find((m: any) => m.name.includes(str))?.name.replace("models/", "");

    // Priority List for PRO
    const pro = find("gemini-2.5-pro") || find("gemini-2.0-pro") || find("gemini-1.5-pro");

    // Priority List for FLASH
    const flash = find("gemini-2.5-flash") || find("gemini-2.0-flash") || find("gemini-1.5-flash");
    
    // 3. FINAL FALLBACKS (If your key is very old or very new)
    // If we found nothing, we guess 'gemini-2.5-flash' because 1.5 is retired.
    return { 
      pro: pro || "gemini-2.5-flash", 
      flash: flash || "gemini-2.5-flash" 
    };

  } catch (e) {
    console.warn("⚠️ Network error listing models. Using Gemini 2.5 defaults.");
    return { pro: "gemini-2.5-flash", flash: "gemini-2.5-flash" };
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // --- 1. GET MODEL IDS (Will pick 2.5 or 2.0) ---
    const modelIds = await getModelIds(GEMINI_API_KEY!);
    console.log(`✅ Using Models -> Primary: ${modelIds.pro} | Fallback: ${modelIds.flash}`);

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

    // --- 2. EXECUTE WITH PRIMARY ---
    try {
        const modelPro = genAI.getGenerativeModel({ model: modelIds.pro });
        const result = await modelPro.generateContent(prompt);
        textResponse = result.response.text();
    } catch (proError: any) {
        console.warn(`⚠️ Primary model (${modelIds.pro}) failed. Switching to Fallback (${modelIds.flash})...`);
        
        // --- 3. EXECUTE WITH FALLBACK ---
        const modelFlash = genAI.getGenerativeModel({ model: modelIds.flash });
        const result = await modelFlash.generateContent(prompt);
        textResponse = result.response.text();
    }

    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ Search API Fatal Error:", error);
    return NextResponse.json(
      { error: "Failed to generate results", details: error.message },
      { status: 500 }
    );
  }
}
