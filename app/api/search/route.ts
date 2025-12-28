import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// 1. Securely get the API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const prompt = `
      You are an expert software engineer and tech consultant.
      User is looking for: "${query}"
      
      List 5 to 7 of the best, industry-standard software tools or websites for this specific task.
      Include a mix of premium (industry standard) and free/open-source options.
      
      Return ONLY a valid JSON object with this exact structure:
      {
        "summary": "A 2-sentence explanation of what these tools are generally used for.",
        "tools": [
          {
            "title": "Tool Name",
            "url": "Official Website URL",
            "description": "Short 1-sentence description of what it does.",
            "isFree": true/false,
            "isOfficial": true/false
          }
        ]
      }
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

    let textResponse = "";

    // --- SMART FALLBACK SYSTEM ---
    try {
      console.log("Attempting to use Gemini 1.5 PRO...");
      const modelPro = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await modelPro.generateContent(prompt);
      textResponse = result.response.text();
      console.log("Success with PRO model.");
    } catch (proError) {
      console.warn("Pro model failed or limit reached. Switching to FLASH fallback...");
      
      // If Pro fails, we immediately try Flash
      const modelFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await modelFlash.generateContent(prompt);
      textResponse = result.response.text();
      console.log("Success with FLASH model.");
    }
    // -----------------------------

    // Clean up response
    const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate results", details: error.message },
      { status: 500 }
    );
  }
}
