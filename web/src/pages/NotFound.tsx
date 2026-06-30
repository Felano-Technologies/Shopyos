import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '../components/SEO';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 animate-fade-in">
      <SEO title="Page Not Found" />
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-navy/10 mb-4 select-none">404</div>
        <h1 className="text-3xl font-bold text-body mb-3">Page not found</h1>
        <p className="text-subtle mb-8 text-sm leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-navy hover:bg-navy-mid text-white font-bold px-8 py-3 rounded-full text-sm transition-colors shadow-md"
        >
          Go Home
        </button>
      </div>
    </div>
  );
};
