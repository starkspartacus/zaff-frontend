'use client';

import React from 'react';
import { SpotlightCard } from '@/components/seraui/spotlight-card';
import { Marquee } from '@/components/seraui/marquee';
import {
  ShoppingCart,
  Package,
  Wrench,
  Users,
  Receipt,
  Layers,
  Database,
  Shield,
  RotateCcw,
  Smartphone,
  Printer,
  Truck,
} from 'lucide-react';

const features = [
  {
    icon: <ShoppingCart className="text-amber-400" size={28} />,
    title: 'Caisse POS Tactile Ultra-Rapide',
    desc: 'Encaissement éclair en Espèces, Carte, Mobile Money ou Crédit. Décrémentation automatique du stock et génération de facture.',
  },
  {
    icon: <Users className="text-yellow-400" size={28} />,
    title: 'Canal Revendeurs & Double Prix',
    desc: 'Basculez entre prix client standard et tarif revendeur. Gestion complète des retours de lots invendus avec réintégration de stock.',
  },
  {
    icon: <Wrench className="text-orange-400" size={28} />,
    title: 'Atelier SAV & Diagnostics',
    desc: 'Suivi par étape du matériel confié : Reçu, Diagnostic, Attente pièces, Réparation, Restitution. Coûts pièces et main-d\'œuvre.',
  },
  {
    icon: <Shield className="text-emerald-400" size={28} />,
    title: 'Garanties & Numéros de Série',
    desc: 'Émission automatique de garanties associées aux ventes. Calcul d\'expiration et vérification instantanée par IMEI ou n° de série.',
  },
  {
    icon: <Printer className="text-cyan-400" size={28} />,
    title: 'Factures Thermiques & A4',
    desc: 'Impression professionnelle conforme aux tickets 80mm de caisse ou factures A4 avec logo or vectoriel et décharge de garantie.',
  },
  {
    icon: <Database className="text-purple-400" size={28} />,
    title: 'Multi-Tenant MongoDB Hermétique',
    desc: 'Chaque établissement possède sa propre base de données MongoDB isolée. Zéro risque de fuite de données entre boutiques.',
  },
];

const brands = [
  'Apple iPhone', 'Samsung Galaxy', 'Xiaomi', 'Tecno', 'Infinix',
  'HP Laptop', 'Dell', 'Lenovo', 'MacBook Pro', 'JBL Audio', 'PlayStation'
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 border-t border-zinc-900 bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Ruban des marques */}
        <div className="mb-16">
          <p className="text-center text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-6">
            Compatible avec l\'ensemble de vos marques et accessoires
          </p>
          <Marquee pauseOnHover={true} className="py-2">
            {brands.map((b) => (
              <div
                key={b}
                className="px-6 py-2.5 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-300 text-sm font-medium hover:border-amber-500/40 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {b}
              </div>
            ))}
          </Marquee>
        </div>

        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
            Tout ce dont votre boutique a besoin,{' '}
            <span className="text-amber-400">sans compromis</span>
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg">
            Une suite complète qui remplace les logiciels de caisse obsolètes et les tableurs dispersés.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <SpotlightCard key={i} className="p-8 flex flex-col justify-between group">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
