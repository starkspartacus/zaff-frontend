'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Clock, PackageCheck, PackagePlus, Store, Wrench, TrendingUp, AlertTriangle, ShoppingCart } from 'lucide-react';
import { useStockModels } from '@/lib/queries';
import { ProductVisual } from '@/components/products/product-visual';
import type { StockFamily, StockVersion } from '@/lib/types';

const CONDITION: Record<string, string> = { new: 'Neuf', refurbished: 'Reconditionné', used: 'Occasion' };
type Filter = 'all' | 'out' | 'low' | 'aging' | 'reorder';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'out', label: 'Versions en rupture' },
  { id: 'low', label: 'Stock bas' },
  { id: 'aging', label: 'Stock dormant' },
  { id: 'reorder', label: 'À recommander' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pretty = (slug: string) => (slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ') : 'Sans catégorie');

const matchVersion = (v: StockVersion, f: Filter) =>
  f === 'all' || (f === 'out' && v.status === 'out') || (f === 'low' && v.status === 'low') || (f === 'aging' && v.agingUnits > 0) || (f === 'reorder' && v.reorder > 0);

/**
 * Stock par modèle et capacité : chaque modèle (famille) avec ses versions (capacité, couleur, état),
 * ce qui est vendable, ce qui est dehors (revendeurs, atelier), le rythme de vente, l'âge du stock et quoi racheter.
 */
export function StockByModel({ search, canManage, formatPrice }: { search: string; canManage: boolean; formatPrice: (v: number) => string }) {
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data, isLoading, error } = useStockModels(days);

  const categories = useMemo(() => [...new Set((data?.families || []).map((f) => f.category))].sort(), [data]);
  const families = useMemo(() => {
    const q = norm(search.trim());
    return (data?.families || [])
      .filter((f) => !category || f.category === category)
      .filter((f) => !q || norm([f.brand, f.name, ...f.versions.flatMap((v) => [v.capacity, v.color, v.sku])].filter(Boolean).join(' ')).includes(q))
      .filter((f) => f.versions.some((v) => matchVersion(v, filter)));
  }, [data, search, category, filter]);

  if (isLoading) return <div className="p-10 text-center text-neutral-500 text-sm">Chargement du stock par modèle…</div>;
  if (error || !data) return <div className="p-10 text-center text-red-400 text-sm">Impossible de charger le stock par modèle.</div>;
  const t = data.totals;

  const kpis = [
    { label: 'Vendables', value: `${t.inStock}`, hint: `${t.families} modèles · ${t.versions} versions`, icon: PackageCheck, tone: 'text-emerald-400' },
    { label: 'Chez les revendeurs', value: `${t.consigned}`, hint: 'en dépôt', icon: Store, tone: 'text-sky-400' },
    { label: 'Atelier / défectueux', value: `${t.inRepair + t.defective}`, hint: `${t.defective} défectueux`, icon: Wrench, tone: 'text-amber-400' },
    { label: `Vendus (${days} j)`, value: `${t.sold}`, hint: 'toutes versions', icon: TrendingUp, tone: 'text-gold-soft' },
    canManage && t.value != null
      ? { label: "Valeur d'achat", value: formatPrice(t.value), hint: `vente : ${formatPrice(t.saleValue)}`, icon: ShoppingCart, tone: 'text-gold-soft' }
      : { label: 'Valeur de vente', value: formatPrice(t.saleValue), hint: 'prix public', icon: ShoppingCart, tone: 'text-gold-soft' },
    { label: 'Stock dormant', value: `${t.agingUnits}`, hint: `appareils > ${data.agingDays} j`, icon: Clock, tone: t.agingUnits ? 'text-red-400' : 'text-neutral-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800/80">
            <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <k.icon className={`w-3.5 h-3.5 ${k.tone}`} /> {k.label}
            </span>
            <p className={`text-xl font-bold mt-1 ${k.tone}`}>{k.value}</p>
            <p className="text-[10px] text-neutral-500">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border ${filter === f.id ? 'bg-gold text-ink border-gold' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}
          >
            {f.label}
            {f.id === 'out' && t.outVersions ? ` (${t.outVersions})` : ''}
            {f.id === 'low' && t.lowVersions ? ` (${t.lowVersions})` : ''}
          </button>
        ))}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Catégorie"
          className="h-8 px-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-white"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {pretty(c)}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Période des ventes"
          className="h-8 px-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-white ml-auto"
        >
          {[7, 30, 90, 180].map((d) => (
            <option key={d} value={d}>
              Ventes sur {d} jours
            </option>
          ))}
        </select>
      </div>

      {families.length === 0 ? (
        <div className="p-10 text-center text-neutral-500 text-sm rounded-3xl border border-dashed border-neutral-800">Aucun modèle ne correspond.</div>
      ) : (
        <div className="space-y-3">
          {families.map((f) => (
            <FamilyCard
              key={f.key}
              family={f}
              filter={filter}
              days={days}
              agingDays={data.agingDays}
              canManage={canManage}
              formatPrice={formatPrice}
              open={!!open[f.key] || filter !== 'all'}
              onToggle={() => setOpen((o) => ({ ...o, [f.key]: !o[f.key] }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FamilyCard({
  family: f,
  filter,
  days,
  agingDays,
  canManage,
  formatPrice,
  open,
  onToggle,
}: {
  family: StockFamily;
  filter: Filter;
  days: number;
  agingDays: number;
  canManage: boolean;
  formatPrice: (v: number) => string;
  open: boolean;
  onToggle: () => void;
}) {
  const versions = f.versions.filter((v) => matchVersion(v, filter));
  return (
    <div className="rounded-3xl bg-neutral-950/80 border border-neutral-800/80 overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="w-full p-4 flex items-center gap-3 text-left">
        <ProductVisual imageId={f.imageId} category={f.category} brand={f.brand} name={f.name} size="thumb" className="w-14 h-14 shrink-0" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            {pretty(f.category)}
            {f.brand ? ` · ${f.brand}` : ''}
          </p>
          <p className="text-sm font-bold text-white truncate">{f.name}</p>
          {/* Capacités, comme le sélecteur d'une fiche de vente : dispo / épuisé, prix à partir de */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {f.capacities.map((c) => (
              <span
                key={c.capacity || '-'}
                className={`px-2 py-0.5 rounded-lg text-[10px] border ${
                  c.inStock > 0 ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/5' : 'border-neutral-800 text-neutral-500 line-through decoration-neutral-600'
                }`}
                title={c.colors.join(', ')}
              >
                {c.capacity || 'Standard'} · {c.inStock}
                {c.fromPrice ? ` · dès ${formatPrice(c.fromPrice)}` : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-black ${f.inStock ? 'text-white' : 'text-red-400'}`}>{f.inStock}</p>
          <p className="text-[10px] text-neutral-500">en stock</p>
          <p className="text-[10px] text-gold-soft">
            {f.sold} vendu(s) / {days} j
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {(f.consigned > 0 || f.inRepair + f.defective > 0 || f.agingUnits > 0 || f.outVersions > 0) && (
        <div className="px-4 pb-3 -mt-1 flex flex-wrap gap-1.5 text-[10px]">
          {f.consigned > 0 && <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-300">{f.consigned} chez les revendeurs</span>}
          {f.inRepair + f.defective > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300">{f.inRepair + f.defective} atelier / défectueux</span>}
          {f.outVersions > 0 && <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-300">{f.outVersions} version(s) en rupture</span>}
          {f.agingUnits > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-300">
              {f.agingUnits} en stock depuis plus de {agingDays} j
            </span>
          )}
        </div>
      )}
      {open && (
        <div className="border-t border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-[11px] min-w-[760px]">
            <thead className="bg-neutral-900/60 text-neutral-400">
              <tr>
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-2 text-center">Dispo</th>
                <th className="py-2.5 px-2 text-center">Dehors</th>
                <th className="py-2.5 px-2 text-center">Vendus</th>
                <th className="py-2.5 px-2 text-center" title="Jours de vente couverts par le stock au rythme actuel">
                  Couverture
                </th>
                <th className="py-2.5 px-2 text-center">Âge du stock</th>
                <th className="py-2.5 px-2 text-right">Prix</th>
                {canManage && <th className="py-2.5 px-2 text-right">Valeur achat</th>}
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {versions.map((v) => (
                <tr key={v.productId}>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-white">{[v.capacity, v.color].filter(Boolean).join(' · ') || 'Version unique'}</p>
                    <p className="text-[10px] text-neutral-500">
                      {CONDITION[v.condition] || v.condition}
                      {v.sku ? ` · ${v.sku}` : ''}
                    </p>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-lg font-bold ${
                        v.status === 'out' ? 'bg-red-500/15 text-red-300' : v.status === 'low' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {v.inStock}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center text-neutral-400">
                    {v.consigned + v.inRepair + v.defective > 0 ? (
                      <span title={`${v.consigned} en dépôt · ${v.inRepair} atelier · ${v.defective} défectueux`}>{v.consigned + v.inRepair + v.defective}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center text-white">{v.sold || '—'}</td>
                  <td className="py-2.5 px-2 text-center">
                    {v.coverDays == null ? <span className="text-neutral-600">—</span> : <span className={v.coverDays < 7 ? 'text-amber-300 font-bold' : 'text-neutral-300'}>{v.coverDays} j</span>}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {v.avgAgeDays == null ? (
                      <span className="text-neutral-600">—</span>
                    ) : (
                      <span className={v.agingUnits ? 'text-red-300 font-bold' : 'text-neutral-300'} title={`Plus ancien : ${v.oldestDays} j`}>
                        {v.avgAgeDays} j{v.agingUnits ? ` · ${v.agingUnits} dormant(s)` : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <p className="text-white font-semibold">{formatPrice(v.salePrice)}</p>
                    {v.resellerPrice > 0 && <p className="text-[10px] text-neutral-500">Revendeur {formatPrice(v.resellerPrice)}</p>}
                  </td>
                  {canManage && (
                    <td className="py-2.5 px-2 text-right whitespace-nowrap text-gold-soft">
                      {formatPrice(v.value || 0)}
                      <p className="text-[10px] text-neutral-500">achat {formatPrice(v.purchasePrice || 0)}</p>
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {v.reorder > 0 && <p className="text-[10px] text-amber-300 font-bold">Racheter {v.reorder}</p>}
                    {canManage && v.tracked && (
                      <Link href={`/app/receive?product=${v.productId}`} className="inline-flex items-center gap-1 text-[11px] text-gold-soft hover:underline">
                        <PackagePlus className="w-3.5 h-3.5" /> Mettre en stock
                      </Link>
                    )}
                    {!v.tracked && v.status !== 'ok' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
