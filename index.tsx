/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

interface Favorite {
  term: string;
  lyrics: string;
}

const App: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialState, setInitialState] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [view, setView] = useState<'search' | 'favorites'>('search');
  
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3); // Default speed
  const lyricsContainerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('lyrics-favorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    } catch (e) {
      console.error('Falha ao carregar favoritos do localStorage', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('lyrics-favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error('Falha ao salvar favoritos no localStorage', e);
    }
  }, [favorites]);

  useEffect(() => {
    let scrollInterval: number | undefined;

    if (isScrolling && lyricsContainerRef.current) {
      scrollInterval = window.setInterval(() => {
        if (lyricsContainerRef.current) {
          const el = lyricsContainerRef.current;
          if (el.scrollTop < el.scrollHeight - el.clientHeight) {
            el.scrollTop += 1;
          } else {
            setIsScrolling(false); // Stop at the end
          }
        }
      }, 150 - scrollSpeed * 12); // Adjust timing based on speed
    }

    return () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [isScrolling, scrollSpeed]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchTerm.trim()) {
      setError('Por favor, digite o nome da música e do artista.');
      return;
    }

    setIsScrolling(false);
    if(lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
    }
    
    setIsLoading(true);
    setError('');
    setLyrics('');
    setInitialState(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const prompt = `Qual é a letra completa da música "${searchTerm}"? Retorne apenas a letra. Se não conseguir encontrar a letra, retorne a frase "LETRA_NAO_ENCONTRADA".`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const generatedLyrics = response.text.trim();

      if (!generatedLyrics || generatedLyrics === 'LETRA_NAO_ENCONTRADA') {
        setError(`Não foi possível encontrar a letra para "${searchTerm}". Por favor, verifique o nome da música e do artista e tente novamente.`);
      } else {
        setLyrics(generatedLyrics);
      }
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao buscar a letra. Por favor, tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFavorite = (term: string) => favorites.some((fav) => fav.term === term);

  const toggleFavorite = () => {
    if (!searchTerm || !lyrics) return;
    if (isFavorite(searchTerm)) {
      setFavorites(favorites.filter((fav) => fav.term !== searchTerm));
    } else {
      setFavorites([...favorites, { term: searchTerm, lyrics }]);
    }
  };
  
  const removeFavorite = (termToRemove: string) => {
    setFavorites(favorites.filter((fav) => fav.term !== termToRemove));
  };
  
  const viewFavorite = (favorite: Favorite) => {
    setSearchTerm(favorite.term);
    setLyrics(favorite.lyrics);
    setError('');
    setInitialState(false);
    setIsScrolling(false);
    if(lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
    }
    setView('search');
  };

  const toggleScroll = () => {
    if (!lyrics) return;
    setIsScrolling(!isScrolling);
  };
  

  return (
    <div className="app-container">
      <header>
        <h1>LETRADOR</h1>
        <p>Encontre, ouça e salve as letras das suas músicas favoritas</p>
        <nav className="navigation">
          <button onClick={() => setView('search')} disabled={view === 'search'}>
            Pesquisar
          </button>
          <button onClick={() => setView('favorites')} disabled={view === 'favorites'}>
            Favoritos ({favorites.length})
          </button>
        </nav>
      </header>
      <main>
        {view === 'search' ? (
          <>
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o nome da música e artista..."
                className="search-input"
                aria-label="Nome da música e artista"
              />
              <button type="submit" className="search-button" disabled={isLoading}>
                {isLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
            <div className="results-container">
              {isLoading && (
                <div className="spinner-container" aria-label="Carregando">
                  <div className="spinner"></div>
                </div>
              )}
              {error && <p className="error-message">{error}</p>}
              {lyrics && (
                <div className="lyrics-display">
                  <div className="lyrics-header">
                     <h2>{searchTerm}</h2>
                     <div className="controls-wrapper">
                        <div className="karaoke-controls">
                           <button onClick={toggleScroll} className="play-pause-button" aria-label={isScrolling ? "Pausar rolagem" : "Iniciar rolagem"}>
                             {isScrolling ? '⏸' : '▶'}
                           </button>
                           <label htmlFor="speed-slider">Velocidade</label>
                           <input
                             type="range"
                             id="speed-slider"
                             min="1"
                             max="10"
                             value={scrollSpeed}
                             onChange={(e) => setScrollSpeed(Number(e.target.value))}
                             aria-label="Ajustar velocidade da rolagem"
                           />
                        </div>
                        <button onClick={toggleFavorite} className={`favorite-button ${isFavorite(searchTerm) ? 'favorited' : ''}`} aria-label="Adicionar aos favoritos">
                           {isFavorite(searchTerm) ? '★ Favorito' : '☆ Adicionar aos Favoritos'}
                        </button>
                     </div>
                  </div>
                  <pre ref={lyricsContainerRef}>{lyrics}</pre>
                </div>
              )}
              {initialState && !isLoading && !error && !lyrics && (
                <p className="placeholder-text">A letra da música aparecerá aqui.</p>
              )}
            </div>
          </>
        ) : (
          <div className="favorites-container results-container">
            <h2>Músicas Favoritas</h2>
            {favorites.length > 0 ? (
              <ul className="favorites-list">
                {favorites.map((fav) => (
                  <li key={fav.term} className="favorite-item">
                    <span onClick={() => viewFavorite(fav)} className="favorite-term" role="button" tabIndex={0}>
                      {fav.term}
                    </span>
                    <button onClick={() => removeFavorite(fav.term)} className="remove-favorite-button">
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="placeholder-text">Você ainda não salvou nenhuma música.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);