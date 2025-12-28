import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
    try {
        const { query } = await request.json();
        console.log(`[Server] Searching for: ${query}`);

        // --- STEP 1: AUTO-DISCOVERY (The "Out of Box" Solution) ---
        // Instead of guessing "gemini-pro", we ASK Google what is available for this key.
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

        const listResponse = await fetch(listUrl);

        if (!listResponse.ok) {
            const errorText = await listResponse.text();
            throw new Error(`Failed to fetch model list: ${errorText}`);
        }

        const listData = await listResponse.json();

        // Find a model that supports 'generateContent' and is a Gemini model
        const validModel = listData.models?.find((m: any) =>
            m.name.includes("gemini") &&
            m.supportedGenerationMethods.includes("generateContent")
        );

        if (!validModel) {
            throw new Error("No Gemini models found for this API Key.");
        }

        const modelName = validModel.name; // e.g., "models/gemini-1.5-flash-001"
        console.log(`[Server] Auto-Detected Valid Model: ${modelName}`);

        // --- STEP 2: EXECUTION ---
        // Now we use the EXACT model name Google gave us. No more 404s.
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        const genResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `
                        Return strictly valid JSON. 
                        List top 8 official software tools for: "${query}".
                        Prioritize Industry Standards.
                        Format: { "summary": "...", "tools": [{ "title": "...", "url": "...", "description": "...", "isFree": false, "isOfficial": true }] }
                        `
                    }]
                }]
            })
        });

        if (!genResponse.ok) {
            const errorText = await genResponse.text();
            throw new Error(`Generation Failed: ${errorText}`);
        }

        const data = await genResponse.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        // Clean JSON
        let cleanText = rawText.replace(/```json/g, '').replace(/```/g, '');
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        return NextResponse.json(JSON.parse(cleanText));

    } catch (error: any) {
        console.error("CRITICAL ERROR:", error);
        return NextResponse.json({
            error: "System Error",
            details: error.message
        }, { status: 500 });
    }
}