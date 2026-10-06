import { LandingNav } from '@/components/layout/landing-nav';
import { LandingHero } from '@/components/layout/landing-hero';
import { LandingFeatures } from '@/components/layout/landing-features';
import { LandingFooter } from '@/components/layout/landing-footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <LandingNav />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
