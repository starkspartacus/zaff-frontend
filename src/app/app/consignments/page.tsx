'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HandCoins, Plus, Search, Clock, AlertTriangle, MessageCircle, Printer, X, Check, Undo2, BadgeCheck, Trash2, UserPlus, Phone, IdCard, History, PackageCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/forms/geo-fields';
import { BarcodeScanner } from '@/components/scan/barcode-scanner';
import { scanFeedback } from '@/components/scan/feedback';
import { BlurFade } from '@/components/magicui/blur-fade';
import { formatInternational, toE164 } from '@/lib/geo';
import { useConsignments, useConsignmentSummary, useCreateConsignment, useCustomers, useSettleConsignment } from '@/lib/queries';
import { errorMessage, type Consignment, type Customer, type ScanLookup } from '@/lib/types';
import { cn } from '@/lib/utils';

const money = (n: number, currency: string) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${currency}`;
const dateFr = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
const dateTime = (d: string | Date) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
const waLink = (phone: string | null | undefined, text: string) => `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** Couleur du compteur : vert dans le délai, orange le jour prévu, rouge en retard */
function dueTone(c: Consignment) {
  if (c.status !== 'open') return 'bg-neutral-800 text-neutral-300 border-neutral-700';
  if (c.overdue) return 'bg-red-500/15 text-red-400 border-red-500/40';
  const left = new Date(c.dueAt).getTime() - Date.now();
  return left < 24 * 3600 * 1000 ? 'bg-amber-500/15 text-amber-400 border-amber-500/40' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
}

/** Texte du bon de remise (WhatsApp / impression) */
function handoverText(c: Consignment, shop: string, currency: string) {
  const out = c.items.filter((i) => i.status === 'out');
  return [
    `*Bon de remise ${c.code}* — ${shop}`,
    `Revendeur : ${c.customerName}${c.customerPhone ? ` (${formatInternational(c.customerPhone)})` : ''}`,
    `Remis le ${dateTime(c.createdAt)} par ${c.handedByName || 'la boutique'}`,
    '',
    ...out.map((i) => `• ${i.productName} — N° ${i.serialNumber} — ${money(i.price, currency)}`),
    '',
    `Total : ${money(out.reduce((n, i) => n + i.price, 0), currency)}`,
    `Retour ou paiement prévu le ${new Date(c.dueAt).toLocaleDateString('fr-FR')}.`,
  ].join('\n');
}

function reminderText(c: Consignment, shop: string, currency: string) {
  const out = c.items.filter((i) => i.status === 'out');
  return [
    `Bonjour ${c.customerName}, c'est ${shop}.`,
    `Vous avez toujours ${out.length > 1 ? `${out.length} appareils` : 'un appareil'} de chez nous depuis ${c.daysOut} jour${c.daysOut > 1 ? 's' : ''} (bon ${c.code}) :`,
    ...out.map((i) => `• ${i.productName} — N° ${i.serialNumber} — ${money(i.price, currency)}`),
    `Merci de passer régler ${money(c.outValue, currency)} ou rapporter la marchandise.`,
  ].join('\n');
}

function printHandover(c: Consignment, shop: string, currency: string) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  const rows = c.items
    .filter((i) => i.status === 'out')
    .map((i) => `<tr><td>${i.productName}</td><td style="font-family:monospace">${i.serialNumber}</td><td style="text-align:right">${money(i.price, currency)}</td></tr>`)
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${c.code}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:13px;text-align:left}.sig{display:flex;gap:40px;margin-top:48px}.sig div{flex:1;border-top:1px solid #999;padding-top:6px;font-size:12px;color:#555}</style></head><body>
  <h1>Bon de remise ${c.code}</h1><p>${shop}</p>
  <p><b>Revendeur :</b> ${c.customerName}${c.customerPhone ? ` — ${formatInternational(c.customerPhone)}` : ''}<br><b>Remis le :</b> ${dateTime(c.createdAt)} par ${c.handedByName || ''}<br><b>Retour ou paiement prévu le :</b> ${new Date(c.dueAt).toLocaleDateString('fr-FR')}</p>
  <table><thead><tr><th>Appareil</th><th>N° de série / IMEI</th><th style="text-align:right">Prix convenu</th></tr></thead><tbody>${rows}</tbody></table>
  <p><b>Total : ${money(c.outValue, currency)}</b></p>
  <p style="font-size:12px;color:#555">Les appareils restent la propriété de ${shop} jusqu'à leur paiement. Le revendeur s'engage à les payer ou à les rapporter en bon état.</p>
  <div class="sig"><div>Signature du revendeur</div><div>Signature de la boutique</div></div>
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export default function ConsignmentsPage() {
  return (
    <Suspense fallback={null}>
      <ConsignmentsScreen />
    </Suspense>
  );
}

function ConsignmentsScreen() {
  const { establishment } = useAuth();
  const currency = establishment?.currency || 'F CFA';
  const shop = establishment?.name || 'Notre boutique';
  const params = useSearchParams();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data: list = [], isLoading } = useConsignments(tab);
  const { data: summary } = useConsignmentSummary();
  const [search, setSearch] = useState('');
  const [handover, setHandover] = useState(false);
  const [settling, setSettling] = useState<{ c: Consignment; serial?: string } | null>(null);

  // Arrivée depuis un scan : « ?serial=IMEI » ouvre directement le retour de cet appareil
  const wanted = params.get('serial')?.toUpperCase().replace(/\s+/g, '') || '';
  const [autoDone, setAutoDone] = useState(false);
  const autoC = !autoDone && wanted ? list.find((x) => x.items.some((i) => i.serialNumber === wanted && i.status === 'out')) : undefined;
  const active = settling ?? (autoC ? { c: autoC, serial: wanted } : null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return list.filter((c) => !q || c.customerName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.items.some((i) => i.serialNumber.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q)));
  }, [list, search]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-gold" /> Revendeurs
          </h1>
          <p className="text-xs text-neutral-400 mt-1">Marchandise confiée aux revendeurs : qui l&apos;a, depuis quand, ce qu&apos;il doit</p>
        </div>
        <button onClick={() => setHandover(true)} className="h-11 px-4 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-gold/20">
          <Plus className="w-4 h-4" /> Remettre à un revendeur
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="Appareils dehors" value={String(summary?.units ?? 0)} sub={`${summary?.resellers ?? 0} revendeur${(summary?.resellers ?? 0) > 1 ? 's' : ''}`} />
        <Tile label="Valeur dehors" value={money(summary?.value ?? 0, currency)} />
        <Tile label="En retard" value={String(summary?.overdueUnits ?? 0)} danger={(summary?.overdueUnits ?? 0) > 0} sub="appareils" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="flex gap-2">
          {(
            [
              { id: 'open', label: 'En cours', icon: Clock },
              { id: 'closed', label: 'Historique', icon: History },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn('h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5', tab === t.id ? 'bg-gold text-ink' : 'bg-neutral-900 text-neutral-400 border border-neutral-800')}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Revendeur, N° de série, bon…" className="pl-9 h-10 bg-neutral-900 border-neutral-800 text-white rounded-xl" />
        </div>
      </div>

      {isLoading ? (
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-10 text-center space-y-2">
          <HandCoins className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm font-semibold text-white">{tab === 'open' ? 'Aucune marchandise chez un revendeur' : 'Aucun bon clôturé'}</p>
          <p className="text-xs text-neutral-500">Quand un revendeur emporte un appareil, enregistrez-le ici : vous saurez toujours qui l&apos;a.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ConsignmentCard key={c.id} c={c} currency={currency} shop={shop} onSettle={(serial) => setSettling({ c, serial })} />
          ))}
        </div>
      )}

      {handover && <HandoverModal currency={currency} shop={shop} onClose={() => setHandover(false)} />}
      {active && <SettleModal c={active.c} preselect={active.serial} currency={currency} onClose={() => { setSettling(null); setAutoDone(true); }} />}
    </div>
  );
}

function Tile({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-3 sm:p-4', danger ? 'border-red-500/40 bg-red-500/10' : 'border-neutral-800 bg-neutral-950')}>
      <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={cn('text-base sm:text-2xl font-black mt-0.5 truncate', danger ? 'text-red-400' : 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] text-neutral-500">{sub}</p>}
    </div>
  );
}

function ConsignmentCard({ c, currency, shop, onSettle }: { c: Consignment; currency: string; shop: string; onSettle: (serial?: string) => void }) {
  const open = c.status === 'open';
  return (
    <BlurFade className={cn('rounded-3xl border bg-neutral-950 p-4 space-y-3', c.overdue && open ? 'border-red-500/40' : 'border-neutral-800')}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gold/15 border border-gold/40 text-gold font-black flex items-center justify-center shrink-0">{initials(c.customerName)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">{c.customerName}</p>
            <span className="text-[10px] font-mono text-neutral-500">{c.code}</span>
          </div>
          <p className="text-[11px] text-neutral-500">
            {c.customerPhone ? formatInternational(c.customerPhone) + ' · ' : ''}remis le {dateTime(c.createdAt)}
            {c.handedByName ? ` par ${c.handedByName}` : ''}
          </p>
        </div>
        <span className={cn('px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap flex items-center gap-1', dueTone(c))}>
          {open ? (
            <>
              {c.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {c.daysOut === 0 ? "Aujourd'hui" : `${c.daysOut} j`}
            </>
          ) : (
            <>
              <BadgeCheck className="w-3 h-3" /> Soldé
            </>
          )}
        </span>
      </div>

      <div className="divide-y divide-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        {c.items.map((i) => (
          <div key={i.serialNumber} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className={cn('text-xs font-semibold truncate', i.status === 'out' ? 'text-white' : 'text-neutral-500')}>{i.productName}</p>
              <p className="text-[10px] font-mono text-neutral-500">N° {i.serialNumber}</p>
              {i.status !== 'out' && (
                <p className={cn('text-[10px]', i.status === 'sold' ? 'text-emerald-400' : 'text-sky-400')}>
                  {i.status === 'sold' ? `Vendu — facture #${i.invoiceNumber}` : 'Rendu, remis en stock'} · {i.closedAt ? dateTime(i.closedAt) : ''}
                  {i.closedByName ? ` · ${i.closedByName}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-gold-soft">{money(i.price, currency)}</span>
              {i.status === 'out' && (
                <button onClick={() => onSettle(i.serialNumber)} className="h-8 px-2.5 rounded-lg border border-neutral-700 text-[11px] text-neutral-200 hover:border-gold">
                  Retour
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">
              Doit {money(c.outValue, currency)} pour {c.outCount} appareil{c.outCount > 1 ? 's' : ''}
            </span>
            <span className={cn('font-semibold', c.overdue ? 'text-red-400' : 'text-neutral-400')}>
              {c.overdue ? `Retard : prévu le ${dateFr(c.dueAt)}` : `Prévu le ${dateFr(c.dueAt)}`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={waLink(c.customerPhone, reminderText(c, shop, currency))}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('h-10 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5', c.customerPhone ? 'border-emerald-600/50 text-emerald-400' : 'border-neutral-800 text-neutral-600 pointer-events-none')}
            >
              <MessageCircle className="w-4 h-4" /> Relancer
            </a>
            <button onClick={() => printHandover(c, shop, currency)} className="h-10 rounded-xl border border-neutral-700 text-xs font-semibold text-neutral-300 flex items-center justify-center gap-1.5">
              <Printer className="w-4 h-4" /> Bon
            </button>
            <button onClick={() => onSettle()} className="h-10 rounded-xl bg-gold text-ink text-xs font-bold flex items-center justify-center gap-1.5">
              <PackageCheck className="w-4 h-4" /> Clôturer
            </button>
          </div>
        </>
      )}
    </BlurFade>
  );
}

// ─── Remise : 1 revendeur → 2 appareils → 3 délai ───

interface Picked {
  serial: string;
  productName: string;
  price: number;
}

function HandoverModal({ currency, shop, onClose }: { currency: string; shop: string; onClose: () => void }) {
  const { establishment } = useAuth();
  const { data: customers = [] } = useCustomers('all');
  const create = useCreateConsignment();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Customer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(establishment?.countryCode || 'CI');
  const [idNumber, setIdNumber] = useState('');
  const [items, setItems] = useState<Picked[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [days, setDays] = useState(3);
  const [openedAt] = useState(() => Date.now());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Consignment | null>(null);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    const all = [...customers].sort((a, b) => Number(!!b.isReseller) - Number(!!a.isReseller));
    return (q ? all.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q.replace(/\s/g, ''))) : all).slice(0, 8);
  }, [customers, query]);
  const resellerName = chosen?.name || name.trim();
  const total = items.reduce((n, i) => n + (i.price || 0), 0);

  const onScan = async (code: string) => {
    setScanError(null);
    try {
      const res = (await api.get(`/units/lookup/${encodeURIComponent(code)}`)) as unknown as ScanLookup;
      if (res.type !== 'unit') throw new Error(`Code-barres du modèle « ${res.product.name} » : scannez le N° de série / IMEI de l'appareil.`);
      if (res.consignment) throw new Error(`${res.unit.serialNumber} est déjà chez ${res.consignment.customerName} (bon ${res.consignment.code}).`);
      if (!res.sellable) throw new Error(res.unit.status === 'sold' ? `${res.unit.serialNumber} est déjà vendu.` : `${res.unit.serialNumber} n'est pas disponible.`);
      if (items.some((i) => i.serial === res.unit.serialNumber)) throw new Error(`${res.unit.serialNumber} est déjà dans la liste.`);
      const p = res.product;
      setItems((prev) => [...prev, { serial: res.unit.serialNumber, productName: p.name, price: (p.resellerPrice || 0) > 0 ? p.resellerPrice! : p.salePrice }]);
      scanFeedback(true);
    } catch (err) {
      scanFeedback(false);
      setScanError(errorMessage(err));
    }
  };

  const submit = async () => {
    setError(null);
    const e164 = phone.trim() ? toE164(phone, country) : null;
    if (isNew && phone.trim() && !e164) return setError("Ce numéro n'est pas valide pour ce pays.");
    try {
      const c = await create.mutateAsync({
        customerId: chosen?._id,
        customerName: chosen ? undefined : name.trim(),
        customerPhone: chosen ? undefined : e164 || undefined,
        idNumber: idNumber.trim() || undefined,
        serialNumbers: items.map((i) => i.serial),
        prices: Object.fromEntries(items.map((i) => [i.serial, i.price])),
        days,
        notes: notes.trim() || undefined,
      });
      setDone(c);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{done ? 'Marchandise remise' : 'Remettre à un revendeur'}</h2>
            {!done && <p className="text-[11px] text-neutral-500">Étape {step} sur 3 · {['Revendeur', 'Appareils', 'Délai'][step - 1]}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!done && (
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className={cn('h-1.5 flex-1 rounded-full', n <= step ? 'bg-gold' : 'bg-neutral-800')} />
            ))}
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <Check className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm text-neutral-300">
              Bon <b className="text-white">{done.code}</b> : {done.outCount} appareil{done.outCount > 1 ? 's' : ''} chez <b className="text-white">{done.customerName}</b>,{' '}
              {money(done.outValue, currency)}. Retour prévu le {new Date(done.dueAt).toLocaleDateString('fr-FR')}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href={waLink(done.customerPhone, handoverText(done, shop, currency))} target="_blank" rel="noopener noreferrer" className="h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" /> Envoyer le bon
              </a>
              <button onClick={() => printHandover(done, shop, currency)} className="h-11 rounded-xl border border-neutral-700 text-sm font-semibold text-white flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </div>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-gold text-ink font-bold text-sm">
              Terminé
            </button>
          </div>
        ) : step === 1 ? (
          <div className="space-y-3">
            {!isNew ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom ou téléphone du revendeur" className="pl-9 h-11 bg-neutral-900 border-neutral-800 text-white rounded-xl" autoFocus />
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {matches.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => setChosen(c)}
                      className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left', chosen?._id === c._id ? 'border-gold bg-gold/10' : 'border-neutral-800 bg-neutral-900')}
                    >
                      <span className="w-8 h-8 rounded-xl bg-gold/15 text-gold text-xs font-black flex items-center justify-center shrink-0">{initials(c.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white truncate">{c.name}</span>
                        <span className="block text-[11px] text-neutral-500">
                          {c.isReseller ? 'Revendeur' : 'Client'}
                          {c.phone ? ` · ${formatInternational(c.phone)}` : ''}
                          {(c.balance || 0) > 0 ? ` · doit ${money(c.balance || 0, currency)}` : ''}
                        </span>
                      </span>
                      {chosen?._id === c._id && <Check className="w-4 h-4 text-gold" />}
                    </button>
                  ))}
                </div>
                <button onClick={() => (setIsNew(true), setChosen(null), setName(query))} className="w-full h-11 rounded-xl border border-dashed border-gold/50 text-gold-soft text-sm font-semibold flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" /> Nouveau revendeur
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Nom complet *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Ali Traoré" className="h-11 bg-neutral-900 border-neutral-800 text-white rounded-xl" autoFocus />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Téléphone (pour la relance WhatsApp)
                  </label>
                  <PhoneInput country={country} onCountryChange={setCountry} value={phone} onChange={setPhone} />
                </div>
                <button onClick={() => setIsNew(false)} className="text-xs text-neutral-400 underline">
                  Choisir un revendeur déjà enregistré
                </button>
              </div>
            )}
            {(isNew || (chosen && !(chosen as Customer & { idNumber?: string }).idNumber)) && (
              <div>
                <label className="text-xs text-neutral-400 block mb-1 flex items-center gap-1">
                  <IdCard className="w-3 h-3" /> Pièce d&apos;identité (facultatif)
                </label>
                <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="N° de CNI ou passeport" className="h-11 bg-neutral-900 border-neutral-800 text-white rounded-xl" />
              </div>
            )}
            <button disabled={!resellerName} onClick={() => setStep(2)} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold text-sm disabled:opacity-40">
              Continuer avec {resellerName || '…'}
            </button>
          </div>
        ) : step === 2 ? (
          <div className="space-y-3">
            <BarcodeScanner onScan={onScan} placeholder="Scannez ou tapez le N° de série / IMEI" />
            {scanError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">{scanError}</p>}
            <div className="space-y-2">
              {items.map((i, k) => (
                <div key={i.serial} className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{i.productName}</p>
                    <p className="text-[10px] font-mono text-neutral-500">N° {i.serial}</p>
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={i.price || ''}
                    onChange={(e) => setItems((prev) => prev.map((x, j) => (j === k ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x)))}
                    className="w-28 h-9 bg-neutral-950 border-neutral-800 text-white text-right rounded-lg text-xs"
                    aria-label={`Prix convenu pour ${i.serial}`}
                  />
                  <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== k))} className="p-1.5 text-neutral-500 hover:text-red-400" aria-label="Retirer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!items.length && <p className="text-xs text-neutral-500 text-center py-2">Scannez chaque appareil que {resellerName} emporte.</p>}
            </div>
            <p className="text-[11px] text-neutral-500">Prix convenu = ce que {resellerName} paiera à la boutique s&apos;il vend. Sa marge ne regarde que lui.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(1)} className="h-12 rounded-2xl border border-neutral-700 text-sm text-neutral-300">
                Retour
              </button>
              <button disabled={!items.length || items.some((i) => !i.price)} onClick={() => setStep(3)} className="h-12 rounded-2xl bg-gold text-ink font-bold text-sm disabled:opacity-40">
                Continuer ({items.length})
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Dans combien de jours {resellerName} doit-il revenir ?</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 7, 14].map((d) => (
                <button key={d} onClick={() => setDays(d)} className={cn('h-11 rounded-xl border text-sm font-bold', days === d ? 'border-gold bg-gold/15 text-gold-soft' : 'border-neutral-800 bg-neutral-900 text-neutral-300')}>
                  {d} j
                </button>
              ))}
            </div>
            <p className="text-[11px] text-neutral-500">
              Retour prévu le {new Date(openedAt + days * 86400000).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}. Passé ce délai, vous recevez un rappel chaque
              jour.
            </p>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (facultatif)" className="h-11 bg-neutral-900 border-neutral-800 text-white rounded-xl" />
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3 text-xs space-y-1">
              <p className="flex justify-between">
                <span className="text-neutral-400">Revendeur</span> <span className="text-white font-semibold">{resellerName}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-neutral-400">Appareils</span> <span className="text-white font-semibold">{items.length}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-neutral-400">Total convenu</span> <span className="text-gold-soft font-black">{money(total, currency)}</span>
              </p>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(2)} className="h-12 rounded-2xl border border-neutral-700 text-sm text-neutral-300">
                Retour
              </button>
              <button disabled={create.isPending} onClick={submit} className="h-12 rounded-2xl bg-gold text-ink font-bold text-sm disabled:opacity-50">
                Valider la remise
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Retour du revendeur : pour chaque appareil, vendu (il paie) ou rendu (remis en stock) ───

function SettleModal({ c, preselect, currency, onClose }: { c: Consignment; preselect?: string; currency: string; onClose: () => void }) {
  const settle = useSettleConsignment();
  const out = c.items.filter((i) => i.status === 'out');
  const [choice, setChoice] = useState<Record<string, 'sold' | 'returned' | 'keep'>>(() =>
    Object.fromEntries(out.map((i) => [i.serialNumber, preselect && preselect !== i.serialNumber ? 'keep' : 'keep'])),
  );
  const [method, setMethod] = useState<'cash' | 'mobile' | 'credit'>('cash');
  const [deposit, setDeposit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const sold = out.filter((i) => choice[i.serialNumber] === 'sold');
  const returned = out.filter((i) => choice[i.serialNumber] === 'returned');
  const toPay = sold.reduce((n, i) => n + i.price, 0);

  const submit = async () => {
    setError(null);
    try {
      const r = await settle.mutateAsync({
        id: c.id,
        sold: sold.map((i) => i.serialNumber),
        returned: returned.map((i) => i.serialNumber),
        paymentMethod: sold.length ? method : undefined,
        depositAmount: method === 'credit' ? Math.min(deposit, toPay) : undefined,
        depositMethod: method === 'credit' && deposit > 0 ? 'cash' : undefined,
      });
      const parts = [
        sold.length && `${sold.length} vendu${sold.length > 1 ? 's' : ''} — facture #${r.sale?.invoiceNumber} (${money(toPay, currency)}${method === 'credit' ? `, reste ${money(toPay - Math.min(deposit, toPay), currency)} à payer` : ' encaissés'})`,
        returned.length && `${returned.length} remis en stock`,
      ].filter(Boolean);
      setResult(parts.join(' · '));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Retour de {c.customerName}</h2>
            <p className="text-[11px] text-neutral-500">
              Bon {c.code} · chez lui depuis {c.daysOut} jour{c.daysOut > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 text-center">
            <Check className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm text-neutral-200">{result}</p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-gold text-ink font-bold text-sm">
              Terminé
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-400">Pour chaque appareil : vendu par le revendeur (il paie), ou rapporté (remis en stock).</p>
            <div className="space-y-2">
              {out.map((i) => (
                <div key={i.serialNumber} className={cn('rounded-2xl border p-3 space-y-2', i.serialNumber === preselect ? 'border-gold/60' : 'border-neutral-800')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{i.productName}</p>
                      <p className="text-[10px] font-mono text-neutral-500">N° {i.serialNumber}</p>
                    </div>
                    <span className="text-xs font-bold text-gold-soft">{money(i.price, currency)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'sold', label: 'Vendu', icon: BadgeCheck, on: 'border-emerald-500 bg-emerald-500/15 text-emerald-400' },
                        { id: 'returned', label: 'Rendu', icon: Undo2, on: 'border-sky-500 bg-sky-500/15 text-sky-400' },
                        { id: 'keep', label: 'Il le garde', icon: Clock, on: 'border-neutral-500 bg-neutral-800 text-neutral-200' },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setChoice((m) => ({ ...m, [i.serialNumber]: o.id }))}
                        className={cn('h-9 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1', choice[i.serialNumber] === o.id ? o.on : 'border-neutral-800 text-neutral-500')}
                      >
                        <o.icon className="w-3.5 h-3.5" /> {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {sold.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-xs text-neutral-300">
                  {c.customerName} paie <b className="text-white">{money(toPay, currency)}</b> pour {sold.length} appareil{sold.length > 1 ? 's' : ''} vendu{sold.length > 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'cash', label: 'Espèces' },
                      { id: 'mobile', label: 'Mobile Money' },
                      { id: 'credit', label: 'Il paiera plus tard' },
                    ] as const
                  ).map((m) => (
                    <button key={m.id} onClick={() => setMethod(m.id)} className={cn('h-9 rounded-xl border text-[11px] font-bold', method === m.id ? 'border-gold bg-gold/15 text-gold-soft' : 'border-neutral-800 text-neutral-400')}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {method === 'credit' && (
                  <div className="space-y-1">
                    <Input type="number" inputMode="numeric" value={deposit || ''} onChange={(e) => setDeposit(Math.max(0, Number(e.target.value) || 0))} placeholder="Acompte en espèces (facultatif)" className="h-10 bg-neutral-900 border-neutral-800 text-white rounded-xl" />
                    <p className="text-[11px] text-amber-400">Reste à payer : {money(toPay - Math.min(deposit, toPay), currency)} (suivi dans la fiche du revendeur)</p>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">{error}</p>}
            <button disabled={settle.isPending || (!sold.length && !returned.length)} onClick={submit} className="w-full h-12 rounded-2xl bg-gold text-ink font-bold text-sm disabled:opacity-40">
              Enregistrer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
