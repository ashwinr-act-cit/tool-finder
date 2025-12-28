'use client';

import { useState } from 'react';
import axios from 'axios';
import { Search, ExternalLink, Loader2, Zap, ShieldCheck, BadgeCheck } from 'lucide-react';

interface Tool {
  title: string;
  url: string;
  description: string;
  isFree: boolean;
  isOfficial?: boolean;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tool[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setResults([]);
    setSummary('');
    setError('');

    try {
      const response = await axios.post('/api/search', { query });
      setResults(response.data.tools || []);
      setSummary(response.data.summary);
    } catch (error: any) {
      console.error('Search failed', error);
      setError(error.response?.data?.details || error.response?.data?.error || 'Something went wrong. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center min-h-screen">

        {/* Header / Logo Area */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 animate-pulse tracking-tighter">
            TOOL FINDER
          </h1>
          <p className="mt-4 text-gray-400 text-lg tracking-wide uppercase text-xs font-semibold">
            Universal Resource Locator
          </p>
        </div>

        {/* Search Section */}
        <div className="w-full max-w-2xl mb-16">
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
            <div className="relative flex items-center bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-xl p-2 shadow-2xl">
              <Search className="w-6 h-6 text-gray-400 ml-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find the perfect tool..."
                className="w-full bg-transparent border-none focus:ring-0 text-xl px-4 py-3 text-white placeholder-gray-500 outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-semibold text-white hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
              </button>
            </div>
          </form>
        </div>

        {/* Results Section */}
        <div className="w-full max-w-4xl space-y-6">
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-center backdrop-blur-sm">
              <p className="font-bold">SYSTEM ERROR</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
                </div>
              </div>
              <p className="text-purple-400 animate-pulse font-mono">SCANNING NETWORK...</p>
            </div>
          )}

          {!loading && searched && summary && (
            <div className="mb-8 p-6 bg-gray-900/80 backdrop-blur-xl border border-purple-500/50 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-blue-500" />
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <Zap className="w-6 h-6 text-purple-400 fill-purple-400/20" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    AI Smart Insight
                  </h3>
                  <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                    {summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <p className="text-xl">No tools found in this sector.</p>
            </div>
          )}

          {!loading && results.map((tool, index) => (
            <div
              key={index}
              className="group relative bg-gray-900/50 backdrop-blur-sm border border-gray-800 hover:border-purple-500/50 rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.1)] hover:-translate-y-1 overflow-hidden"
            >
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">

                {/* Rank Number */}
                <div className="flex-shrink-0">
                  <span className="text-4xl font-black text-gray-800 group-hover:text-purple-500/20 transition-colors duration-300 font-mono">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                      {tool.title}
                    </h2>
                    {tool.isOfficial && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-900/30 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                        <BadgeCheck className="w-3 h-3" />
                        OFFICIAL SOURCE
                      </span>
                    )}
                    {tool.isFree && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-900/30 text-green-400 border border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                        <ShieldCheck className="w-3 h-3" />
                        FREE / OPEN SOURCE
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 line-clamp-2 text-sm leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0 w-full md:w-auto mt-4 md:mt-0">
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-all duration-300 group-hover:bg-purple-600 group-hover:shadow-lg"
                  >
                    <span>Visit</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}