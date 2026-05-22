import React, { useState } from 'react';

interface SafeImageProps {
    srcChain: (string | undefined)[];
    alt?: string;
    className?: string;
    onLoad?: () => void;
}

export const SafeImage: React.FC<SafeImageProps> = ({ srcChain, alt = '', className, onLoad }) => {
    const [idx, setIdx] = useState(0);

    const validSrcs = srcChain.filter((s): s is string => !!s);

    if (validSrcs.length === 0 || idx >= validSrcs.length) {
        return <div className={`bg-zinc-700 ${className ?? ''}`} />;
    }

    return (
        <img
            src={validSrcs[idx]}
            alt={alt}
            className={className}
            onLoad={onLoad}
            onError={() => setIdx(i => i + 1)}
        />
    );
};
