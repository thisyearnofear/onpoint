'use client';

import { useState } from 'react';
import InteractiveStylingCanvas from '@repo/shared-ui/components/InteractiveStylingCanvas';
import { critiqueOutfit, type CritiqueResponse } from '@onpoint/ai-client';

export default function CollagePage() {
  const [critique, setCritique] = useState<CritiqueResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGetCritique = async () => {
    setLoading(true);
    try {
      // For now, pass a simple description; in future, pass canvas data
      const result = await critiqueOutfit('Current styled outfit');
      setCritique(result);
    } catch (error) {
      console.error('Failed to get critique:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    // Basic save: already persisted via localStorage
    alert('Collage saved locally!');
  };

  const handleShare = () => {
    // Basic share: copy URL or something
    navigator.clipboard.writeText(window.location.href);
    alert('Share link copied to clipboard!');
  };

  return (
    <div>
      <h1>OnPoint Collage Creator</h1>
      <p>Create your perfect fashion collage with interactive styling!</p>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleSave} style={{ marginRight: '10px' }}>Save Collage</button>
        <button onClick={handleShare} style={{ marginRight: '10px' }}>Share</button>
        <button onClick={handleGetCritique} disabled={loading}>
          {loading ? 'Getting Critique...' : 'Get AI Critique'}
        </button>
      </div>
      {critique && (
        <div style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '20px' }}>
          <h3>AI Critique</h3>
          <p><strong>Rating:</strong> {critique.rating}/10</p>
          <p><strong>Feedback:</strong> {critique.feedback}</p>
          {critique.suggestions && (
            <div>
              <strong>Suggestions:</strong>
              <ul>
                {critique.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      <InteractiveStylingCanvas />
    </div>
  );
}
