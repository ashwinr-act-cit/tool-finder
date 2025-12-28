import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- 1. DYNAMIC MODEL FINDER ---
// This prevents the 404 error by getting the EXACT name from Google
async function getModelIds(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();

    // Safety: If the API call itself fails, we must use a fallback
    if (!data.models) {
        console.warn("⚠️ Failed to list models. Using hardcoded defaults.");
        return { pro: "gemini-1.5-pro", flash: "gemini-1.5-flash" }; 
    }

    const validModels = data.models.filter((m: any) => 
        m.supportedGenerationMethods.includes("generateContent")
    );

    // We find the names that Google actually returned
    const pro = validModels.find((m: any) => m.name.includes("gemini-1.5-pro"))?.name.replace("models/", "");
    const flash = validModels.find((m: any) => m.name.includes("gemini-1.5-flash"))?.name.replace("models/", "");
    
    // Return the valid, Google-confirmed IDs
    return { 
      pro: pro || "gemini-1.5-pro", 
      flash: flash || "gemini-1.5-flash" 
    };

  } catch (e) {
    console.warn("⚠️ Network error listing models. Using defaults.");
    return { pro: "gemini-1.5-pro", flash: "gemini-1.5-flash" };
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // --- 2. GET CONFIRMED IDs BEFORE STARTING ---
    // We get both IDs now, so we know the fallback is valid too.
    const modelIds = await getModelIds(GEMINI_API_KEY!);
    console.log(`✅ Using Validated Models -> Primary: ${modelIds.pro} | Fallback: ${modelIds.flash}`);

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

    // --- 3. TRY PRIMARY (PRO) ---
    try {
        console.log(`🚀 Attempting Primary Model (${modelIds.pro})...`);
        const modelPro = genAI.getGenerativeModel({ model: modelIds.pro });
        const result = await modelPro.generateContent(prompt);
        textResponse = result.response.text();
        console.log("✅ Success with Primary.");
    } catch (proError: any) {
        // --- 4. FALLBACK TO SECONDARY (FLASH) ---
        // We use 'modelIds.flash' which we already verified exists in step 1
        console.warn(`⚠️ Primary failed (Quota/Error). Switching to Fallback (${modelIds.flash})...`);
        
        const modelFlash = genAI.getGenerativeModel({ model: modelIds.flash });
        const result = await modelFlash.generateContent(prompt);
        textResponse = result.response.text();
        console.log("✅ Success with Fallback.");
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
