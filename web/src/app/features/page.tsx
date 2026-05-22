'use client';

import { PageShell } from '@/components/PageShell';
import { YoutubeEmbed } from '@/components/YoutubeEmbed';
import { useLanguage } from '@/context/LanguageContext';
import {
  CanvasIcon, AiIcon, RefIcon, FreeIcon, PoseGridIcon, OutfitGridIcon,
} from '@/components/icons';
import { VIDEOS } from '@/lib/siteConfig';

export default function FeaturesPage() {
  const { t } = useLanguage();

  const tools = [
    {
      num: '01',
      title: t.tools.autoColoring.title,
      name: t.tools.autoColoring.name,
      tagline: t.tools.autoColoring.tagline,
      desc: t.tools.autoColoring.desc,
      videoId: VIDEOS.autoColoring,
    },
    {
      num: '02',
      title: t.tools.variation.title,
      name: t.tools.variation.name,
      tagline: t.tools.variation.tagline,
      desc: t.tools.variation.desc,
      videoId: VIDEOS.variation,
    },
    {
      num: '03',
      title: t.features.lightingControl.title,
      name: 'Lighting',
      tagline: t.features.lightingControl.tagline,
      desc: t.features.lightingControl.desc,
      videoId: VIDEOS.lighting,
    },
    {
      num: '04',
      title: t.features.partsCompositing.title,
      name: 'Parts',
      tagline: t.features.partsCompositing.tagline,
      desc: t.features.partsCompositing.desc,
      videoId: VIDEOS.parts,
    },
  ];

  return (
    <PageShell>
      {/* Features overview grid */}
      <section className="content-section">
        <div className="section-label animate-fade-in-up">
          <span className="accent-dot" />
          {t.featuresPage.title}
        </div>
        <h2 className="section-headline animate-fade-in-up">
          {t.featuresPage.subtitle}
        </h2>

        <div className="feature-grid-new">
          {[
            { icon: <CanvasIcon />, title: t.features.canvas.title, desc: t.features.canvas.desc },
            { icon: <AiIcon />, title: t.features.aiGen.title, desc: t.features.aiGen.desc },
            { icon: <RefIcon />, title: t.features.reference.title, desc: t.features.reference.desc },
            { icon: <FreeIcon />, title: t.features.noCostAi.title, desc: t.features.noCostAi.desc },
            { icon: <PoseGridIcon />, title: t.tools.pose.title, desc: t.tools.pose.tagline },
            { icon: <OutfitGridIcon />, title: t.tools.outfit.title, desc: t.tools.outfit.tagline },
          ].map((f) => (
            <div key={f.title} className="feature-card-new">
              <div className="feature-card-icon">{f.icon}</div>
              <h3 className="feature-card-title">{f.title}</h3>
              <p className="feature-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* Tool showcase */}
      <section id="showcase">
        {tools.map((tool, i) => (
          <div key={tool.num}>
            <div className={`showcase-section ${i % 2 === 1 ? 'showcase-reversed' : ''}`}>
              <div className="showcase-text-col">
                <span className="showcase-number">{tool.num}</span>
                <h2 className="showcase-title">{tool.title}</h2>
                {tool.tagline && <p className="showcase-tagline">{tool.tagline}</p>}
                <p className="showcase-desc">{tool.desc}</p>
              </div>
              <div className="showcase-media-col">
                <YoutubeEmbed videoId={tool.videoId} label={tool.name} className="media-placeholder-feature" />
              </div>
            </div>
            {i < tools.length - 1 && <div className="section-divider" />}
          </div>
        ))}
      </section>
    </PageShell>
  );
}
