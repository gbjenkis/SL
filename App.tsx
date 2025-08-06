import React, { useState, useCallback } from 'react';
import { Song } from './types.ts';
import { fetchSongsByKeyword } from './services/geminiService.ts';
import KeywordInput from './components/KeywordInput.tsx';
import SongCard from './components/SongCard.tsx';
import Loader from './components/Loader.tsx';
import ErrorDisplay from './components/ErrorDisplay.tsx';
import { MusicNoteIcon, RefreshIcon, ShareIcon } from './components/icons.tsx';

const App: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [lastSearchedKeyword, setLastSearchedKeyword] = useState<string>('');
  const [keptSongIds, setKeptSongIds] = useState<Set<string>>(new Set());
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleInitialSearch = useCallback(async (keyword: string) => {
    setIsLoading(true);
    setError(null);
    setSongs([]);
    setHasSearched(true);
    setLastSearchedKeyword(keyword);
    setKeptSongIds(new Set()); // Reset kept songs on a new search

    try {
      const fetchedSongs = await fetchSongsByKeyword(keyword, 10, []);
      const songsWithIds = fetchedSongs.map(song => ({ ...song, id: crypto.randomUUID() }));
      setSongs(songsWithIds);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegenerateSongs = useCallback(async () => {
    if (!lastSearchedKeyword) return;

    setIsLoading(true);
    setError(null);

    const keptSongs = songs.filter(song => keptSongIds.has(song.id));
    const countToFetch = 10 - keptSongs.length;

    if (countToFetch <= 0) {
      setIsLoading(false);
      return;
    }

    const linkWordRegex = /'([^']*)'/;
    const excludedLinkWords = keptSongs
      .map(song => {
        const match = song.explanation.match(linkWordRegex);
        return match ? match[1] : null;
      })
      .filter((word): word is string => !!word);

    try {
      const existingSongData = songs.map(({ id, ...rest }) => rest);
      const newFetchedSongs = await fetchSongsByKeyword(
        lastSearchedKeyword, 
        countToFetch, 
        existingSongData,
        excludedLinkWords
      );
      
      const newSongsWithIds = newFetchedSongs.map(song => ({ ...song, id: crypto.randomUUID() }));
      
      let newSongIndex = 0;
      const updatedSongs = songs.map(song => {
          if (keptSongIds.has(song.id)) {
              return song;
          }
          if (newSongIndex < newSongsWithIds.length) {
            return newSongsWithIds[newSongIndex++];
          }
          return song;
      });

      setSongs(updatedSongs);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [lastSearchedKeyword, songs, keptSongIds]);

  const handleToggleKeep = useCallback((songId: string) => {
    setKeptSongIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(songId)) {
        newIds.delete(songId);
      } else {
        newIds.add(songId);
      }
      return newIds;
    });
  }, []);
  
  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }).catch(err => {
      console.error('Failed to copy URL: ', err);
      // Fallback for user
      alert('Failed to copy link. Please copy the URL from your browser bar.');
    });
  }, []);

  const renderContent = () => {
    if (isLoading && songs.length === 0) {
      return <Loader />;
    }
    if (error) {
      return <ErrorDisplay message={error} />;
    }
    if (songs.length > 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
          {songs.map((song, index) => (
            <SongCard 
              key={song.id} 
              song={song} 
              index={index} 
              isKept={keptSongIds.has(song.id)}
              onToggleKeep={handleToggleKeep}
            />
          ))}
        </div>
      );
    }
    if (hasSearched) {
      return <p className="text-center text-slate-400 mt-8">No songs found for this keyword. Try another one!</p>;
    }
    return (
        <div className="text-center text-slate-400 mt-12">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to Song Link!</h2>
            <p>Enter a word and discover famous songs linked to it.</p>
        </div>
    );
  };

  return (
    <>
    <style>{`
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in {
        animation: fade-in 0.5s ease-out forwards;
      }
    `}</style>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-7xl">
        <header className="text-center my-8 relative">
          <div className="absolute top-0 right-0 hidden sm:block">
            <button
              onClick={handleShare}
              disabled={isCopied}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700/50 text-slate-300 font-semibold rounded-full hover:bg-slate-600/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-pink-500"
              aria-label="Copy shareable link"
            >
              <ShareIcon className="h-5 w-5" />
              <span>{isCopied ? 'Copied!' : 'Share App'}</span>
            </button>
          </div>
          <div className="flex items-center justify-center space-x-4 mb-4">
            <MusicNoteIcon className="h-12 w-12 text-pink-500"/>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              Song Link
            </h1>
          </div>
          <p className="text-lg text-slate-300">
            Find the musical connection between a word and the world of pop & rock.
          </p>
        </header>

        <main>
          <div className="mb-8">
            <KeywordInput onGenerate={handleInitialSearch} isLoading={isLoading} />
          </div>
          
          <div className="transition-all duration-300">
            {renderContent()}
          </div>

          {songs.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={handleRegenerateSongs}
                disabled={isLoading || keptSongIds.size === songs.length}
                className="flex items-center justify-center mx-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <RefreshIcon className="h-5 w-5 mr-2" />
                    <span>Get New Suggestions</span>
                  </>
                )}
              </button>
              {keptSongIds.size === songs.length && !isLoading && (
                 <p className="text-sm text-slate-400 mt-3">Uncheck a song to get new suggestions.</p>
              )}
            </div>
          )}
        </main>

        <footer className="text-center text-slate-500 mt-16 pb-4">
          <p>Powered by Gemini API. Built with React & Tailwind CSS.</p>
        </footer>
      </div>
    </div>
    </>
  );
};

export default App;