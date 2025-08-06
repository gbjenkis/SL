import { Song } from '../types.ts';

export const fetchSongsByKeyword = async (
  keyword: string,
  count: number = 10,
  existingSongs: Omit<Song, 'id'>[] = [],
  excludedLinkWords: string[] = []
): Promise<Omit<Song, 'id'>[]> => {
  try {
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword,
        count,
        existingSongs,
        excludedLinkWords,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred while parsing the response.' }));
      throw new Error(errorData.error || `Server responded with status: ${response.status}`);
    }

    const songs = await response.json();
    
    if (Array.isArray(songs)) {
      return songs;
    } else {
      console.error("API proxy response is not in the expected array format:", songs);
      throw new Error("Received unexpected data format from the server.");
    }

  } catch (error) {
    console.error("Error fetching songs from API proxy:", error);
    if (error instanceof Error) {
        // Prepend a user-friendly message to the technical error
        throw new Error(`Failed to generate songs. Please check your keyword or try again later. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching songs.");
  }
};