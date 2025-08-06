// This is a server-side function and should be deployed as a serverless function.
// It is not part of the client-side React bundle.

import { GoogleGenAI, Type } from "@google/genai";
import type { Song } from '../types.ts';

// This function will be executed on a server, where process.env.API_KEY is securely set.
if (!process.env.API_KEY) {
  // This error will be caught by the server environment, not the client.
  throw new Error("API_KEY environment variable is not set on the server.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const createSongSchema = (count: number) => ({
  type: Type.OBJECT,
  properties: {
    songs: {
      type: Type.ARRAY,
      description: `A list of exactly ${count} famous pop or rock songs related to the keyword.`,
      items: {
        type: Type.OBJECT,
        properties: {
          songTitle: {
            type: Type.STRING,
            description: "The title of the song.",
          },
          artist: {
            type: Type.STRING,
            description: "The name of the artist or band.",
          },
          explanation: {
            type: Type.STRING,
            description: "A brief, one-sentence explanation that explicitly states the word in the title or artist name that links to the keyword.",
          },
        },
        required: ["songTitle", "artist", "explanation"],
      },
    },
  },
  required: ["songs"],
});

// Helper function to build the prompt, moved from the frontend service.
const buildPrompt = (
  keyword: string,
  count: number,
  existingSongs: Omit<Song, 'id'>[],
  excludedLinkWords: string[]
): string => {
  const currentYear = new Date().getFullYear();
  let prompt = `You are a music expert specializing in UK chart history. Your task is to find famous pop or rock songs where the song title or artist's name has a direct word correlation with the provided keyword.

The keyword is: "${keyword}".

Your response must follow these strict rules:
1.  **UK Popularity & Recency:** Every song MUST have been popular in the United Kingdom within the last 60 years (from ${currentYear - 60} to today). This includes songs that were either officially released as singles OR received widespread radio play in the UK.
2.  **Direct Correlation:** The connection MUST be a direct, literal word association. A word in the song's title or artist's name should be a synonym, a specific type (hyponym), or a directly related object to the keyword.
3.  **No Abstract Links:** Avoid abstract, thematic, or metaphorical links. The connection must be based on the words themselves.
4.  **Example of a GOOD link:** If the keyword is "Kitchen Utensils", a song with "Spoon" in the title is a perfect match because a spoon is a kitchen utensil.
5.  **Example of a BAD link:** If the keyword is "Kitchen Utensils", the song "Whip It" is a bad match. The connection is too abstract and not a direct word correlation.
6.  **Generate Exactly ${count} Songs:** You must provide exactly ${count} unique songs.
7.  **Unique Artists:** Each song in the list MUST be by a different artist.
8.  **No Keyword in Title/Artist:** The song title and the primary artist name MUST NOT literally contain the keyword "${keyword}".
9.  **Explanation is Crucial:** For each song, you MUST provide a one-sentence explanation that clearly identifies the specific word in the title or artist name that connects to the keyword. For example: "The word 'Spoon' in the title is a type of kitchen utensil."`;

  let ruleNumber = 10;
  if (existingSongs.length > 0) {
    const songExclusions = existingSongs.map(s => `'${s.songTitle}' by ${s.artist}`).join(', ');
    prompt += `\n\n${ruleNumber++}. **Exclude These Songs:** You MUST exclude the following songs from your response: ${songExclusions}.`;

    const artistExclusions = [...new Set(existingSongs.map(s => s.artist))].map(a => `'${a}'`).join(', ');
    if(artistExclusions) {
      prompt += `\n\n${ruleNumber++}. **Exclude These Artists:** You MUST NOT suggest any songs by these artists: ${artistExclusions}.`;
    }
  }

  if (excludedLinkWords.length > 0) {
    const linkWordExclusions = excludedLinkWords.map(word => `'${word}'`).join(', ');
    prompt += `\n\n${ruleNumber++}. **Exclude Link Words:** The primary connecting word in the new suggestions MUST NOT be any of the following: ${linkWordExclusions}. You must find songs that connect to the keyword via different words.`;
  }
  
  prompt += "\n\nReturn only the song title, the main artist, and the explanation for the link.";
  return prompt;
};


// This handler function is designed for a Vercel-like or Netlify-like serverless environment.
// It expects a POST request with a JSON body. The hosting platform will handle turning this into a real endpoint.
export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { keyword, count, existingSongs, excludedLinkWords } = await request.json();

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'Keyword is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prompt = buildPrompt(keyword, count, existingSongs, excludedLinkWords);
    
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: createSongSchema(count),
        temperature: 0.7,
      },
    });

    const jsonString = geminiResponse.text.trim();
    const parsedJson = JSON.parse(jsonString);

    if (parsedJson && Array.isArray(parsedJson.songs)) {
      return new Response(JSON.stringify(parsedJson.songs), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error("The response from the AI was empty or in an unexpected format.");
    }

  } catch (error) {
    console.error("Error in Gemini proxy function:", error);
    const message = error instanceof Error ? error.message : "An unknown server error occurred.";
    return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
  }
}