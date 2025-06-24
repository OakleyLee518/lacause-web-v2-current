"use client";

export default function MinimalTestButton() {
  return (
    <button
      style={{
        position: 'fixed',
        bottom: 40,
        right: 40,
        zIndex: 2147483647,
        background: 'green',
        color: 'white',
        fontSize: 24,
        padding: 20,
        borderRadius: 8,
        touchAction: 'manipulation',
      }}
      onClick={() => alert('Minimal button clicked!')}
    >
      Minimal Button
    </button>
  );
} 