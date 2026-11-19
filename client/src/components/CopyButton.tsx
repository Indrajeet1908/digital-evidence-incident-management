import React, { useState } from 'react';
import { useToast } from './Toast';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  title?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className = '',
  title,
}) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        if (!successful) throw new Error('Copy command returned false');
      }

      setCopied(true);
      toast.success(`Copied ${text} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      toast.error(`Failed to copy ${text} to clipboard`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center p-1 rounded text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 ${className}`}
      title={copied ? `Copied ${text}!` : title || `Copy ${text}`}
      aria-label={label || `Copy ${text}`}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
      {label && <span className="text-[11px] font-mono ml-1">{label}</span>}
    </button>
  );
};
