
import React from 'react';
import ReactDOM from 'react-dom';

interface ToolPortalProps {
    target: 'editor-viewport' | 'editor-sidebar';
    children: React.ReactNode;
}

export const ToolPortal: React.FC<ToolPortalProps> = ({ target, children }) => {
    const el = document.getElementById(target);
    if (!el) return null;
    return ReactDOM.createPortal(children, el);
};
