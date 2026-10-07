'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileSignature,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  previewContract,
  useContractSettings,
  useSaveContract,
  type ContractArticle,
  type ContractLegal,
  type ContractSettings,
  type RenderedContract,
} from '@/lib/contract';
import { errorMessage } from '@/lib/types';
import { ContractDocument } from './contract-document';
import { cn } from '@/lib/utils';

const AUTO_KINDS = ['seller', 'customer', 'product'];
const VARIABLES: Array<[string, string]> = [
  ['{{boutique}}', 'nom de la boutique (ou raison sociale)'],
  ['{{garantie}}', 'durée de garantie de la vente'],
  ['{{pays}}', 'votre pays'],
];

export function ContractSettingsPanel() {
  const { data, isLoading } = useContractSettings();
  if (isLoading || !data) {
    return <div className="rounded-3xl border border-neutral-800 p-10 text-center text-sm text-neutral-500">Chargement du contrat…</div>;
  }
  return <ContractForm saved={data.contract} defaults={data.defaults} />;
}

function ContractForm({ saved, defaults }: { saved: ContractSettings; defaults: ContractSettings }) {
  const save = useSaveContract();
  const [c, setC] = useState<ContractSettings>(saved);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<RenderedContract | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const custom = c.mode === 'custom';

  const update = (patch: Partial<ContractSettings>) => {
    setC((prev) => ({ ...prev, ...patch }));
    setMessage(null);
  };
  const setLegal = (k: keyof ContractLegal, v: string) => update({ legal: { ...c.legal, [k]: v } });
  const setArticle = (id: string, patch: Partial<ContractArticle>) =>
    update({ articles: c.articles.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const move = (i: number, d: -1 | 1) => {
    const list = [...c.articles];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    update({ articles: list });
  };
  const addArticle = () => {
    const id = `custom-${Date.now().toString(36)}`;
    update({ articles: [...c.articles, { id, title: 'Nouvel article', body: '', enabled: true, kind: 'text' }] });
    setOpen(id);
  };
  const resetAll = () => {
    if (!window.confirm('Revenir au modèle ZAFF ? Vos modifications de texte seront remplacées (les informations légales sont conservées).')) return;
    update({ mode: 'default', title: defaults.title, subtitle: defaults.subtitle, intro: defaults.intro, articles: defaults.articles });
  };

  const submit = async () => {
    try {
      const next = await save.mutateAsync(c);
      setC(next);
      setMessage({ ok: true, text: 'Contrat enregistré : il sera remis avec chaque nouvelle vente. Les ventes passées gardent leur version.' });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    }
  };

  const showPreview = async () => {
    setPreviewing(true);
    try {
      setPreview(await previewContract(c));
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setPreviewing(false);
    }
  };

  const enabledCount = c.articles.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Choix du modèle */}
      <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
            <FileSignature className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Contrat de vente et garantie</h2>
            <p className="text-xs text-neutral-500">
              Généré automatiquement après chaque vente : identification de la boutique, du client et de l&apos;appareil (N° de série),
              garantie, conditions de SAV. À imprimer, enregistrer en PDF ou envoyer par WhatsApp.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <ModeCard
            active={!custom}
            onClick={() => update({ mode: 'default' })}
            icon={Sparkles}
            title="Modèle ZAFF"
            text={`${defaults.articles.length} articles rédigés pour la vente de matériel informatique. Recommandé.`}
          />
          <ModeCard
            active={custom}
            onClick={() => update({ mode: 'custom' })}
            icon={FileSignature}
            title="Personnalisé"
            text="Partez du modèle et modifiez, désactivez ou ajoutez des articles."
          />
        </div>
      </section>

      {/* Informations légales */}
      <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gold" /> Informations légales de la boutique
        </h2>
        <p className="text-xs text-neutral-500">Imprimées à l&apos;article « Identification du vendeur ». Laissez vide ce que vous n&apos;avez pas : une ligne en pointillés sera imprimée.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Dénomination sociale" placeholder="Ex. : ZAFF STORE" value={c.legal.legalName} onChange={(v) => setLegal('legalName', v)} max={120} />
          <Field label="Forme juridique" placeholder="Ex. : SARL" value={c.legal.legalForm} onChange={(v) => setLegal('legalForm', v)} max={60} />
          <Field label="RCCM" placeholder="Ex. : CI-ABJ-03-2024-B12-00001" value={c.legal.rccm} onChange={(v) => setLegal('rccm', v)} max={80} />
          <Field label="N° compte contribuable" placeholder="Ex. : 2400000 A" value={c.legal.taxId} onChange={(v) => setLegal('taxId', v)} max={80} />
          <Field label="Représentant qui signe" placeholder="Ex. : Michel Koffi, Gérant" value={c.legal.representative} onChange={(v) => setLegal('representative', v)} max={120} />
          <Field label="Activité" value={c.legal.activity} onChange={(v) => setLegal('activity', v)} max={300} />
        </div>
      </section>

      {/* Texte personnalisé */}
      <AnimatePresence initial={false}>
        {custom && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white">Texte du contrat</h2>
              <button onClick={resetAll} className="text-xs text-neutral-400 hover:text-gold-soft flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Revenir au modèle
              </button>
            </div>
            <Field label="Titre" value={c.title} onChange={(v) => update({ title: v })} max={200} />
            <Field label="Sous-titre" value={c.subtitle} onChange={(v) => update({ subtitle: v })} max={200} />
            <Area label="Introduction" value={c.intro} onChange={(v) => update({ intro: v })} rows={4} max={3000} />

            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-3 text-[11px] text-neutral-400 space-y-1">
              <p className="font-semibold text-neutral-300">Astuces d&apos;écriture</p>
              <p>Une ligne vide = nouveau paragraphe. Une ligne qui commence par « - » = puce.</p>
              <p className="flex flex-wrap gap-x-3 gap-y-1">
                {VARIABLES.map(([v, l]) => (
                  <span key={v}>
                    <code className="text-gold-soft">{v}</code> {l}
                  </span>
                ))}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-300">
                Articles ({enabledCount} imprimés, numérotés automatiquement)
              </p>
              {c.articles.map((a, i) => {
                const auto = AUTO_KINDS.includes(a.kind);
                const original = defaults.articles.find((d) => d.id === a.id);
                const isOpen = open === a.id;
                return (
                  <div key={a.id} className={cn('rounded-2xl border', a.enabled ? 'border-neutral-800 bg-neutral-900/40' : 'border-neutral-900 bg-neutral-950 opacity-60')}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        onClick={() => !auto && setArticle(a.id, { enabled: !a.enabled })}
                        disabled={auto}
                        role="switch"
                        aria-checked={a.enabled}
                        aria-label={`Imprimer l'article ${a.title}`}
                        className={cn('relative w-9 h-5 rounded-full shrink-0 transition-colors', a.enabled ? 'bg-gold' : 'bg-neutral-700', auto && 'opacity-50')}
                      >
                        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', a.enabled ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                      <button onClick={() => setOpen(isOpen ? null : a.id)} className="flex-1 min-w-0 text-left">
                        <span className="block truncate text-sm text-white">{a.title}</span>
                        {(auto || a.kind === 'returns') && (
                          <span className="text-[10px] text-gold-soft flex items-center gap-1">
                            <Lock className="w-3 h-3" /> {a.kind === 'returns' ? 'Rempli depuis vos règles de retour' : 'Rempli automatiquement à chaque vente'}
                          </span>
                        )}
                      </button>
                      <button onClick={() => i > 0 && move(i, -1)} disabled={i === 0} className="p-1.5 text-neutral-500 hover:text-white disabled:opacity-20" aria-label="Monter">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => i < c.articles.length - 1 && move(i, 1)} disabled={i === c.articles.length - 1} className="p-1.5 text-neutral-500 hover:text-white disabled:opacity-20" aria-label="Descendre">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => setOpen(isOpen ? null : a.id)} className="p-1.5 text-neutral-500 hover:text-white" aria-label="Modifier">
                        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2">
                        <Field label="Titre de l'article" value={a.title} onChange={(v) => setArticle(a.id, { title: v })} max={200} />
                        {auto || a.kind === 'returns' ? (
                          <p className="text-[11px] text-neutral-500">
                            {a.kind === 'returns'
                              ? 'Ce texte reprend vos réglages « Retours et garantie » (délais, conditions, solutions) : modifiez-les dans l\'onglet correspondant.'
                              : 'Le contenu (boutique, client, appareil, prix, garantie) est rempli à partir de la vente.'}
                          </p>
                        ) : (
                          <Area label="Texte" value={a.body} onChange={(v) => setArticle(a.id, { body: v })} rows={8} max={8000} />
                        )}
                        <div className="flex justify-end gap-3">
                          {original && original.body !== a.body && !auto && (
                            <button onClick={() => setArticle(a.id, { body: original.body, title: original.title })} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
                              <RotateCcw className="w-3.5 h-3.5" /> Texte d&apos;origine
                            </button>
                          )}
                          {!original && (
                            <button onClick={() => update({ articles: c.articles.filter((x) => x.id !== a.id) })} className="text-xs text-red-400 flex items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={addArticle} className="w-full h-11 rounded-2xl border border-dashed border-neutral-700 text-sm text-neutral-300 hover:border-gold flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Ajouter un article
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="rounded-3xl border border-neutral-800 bg-neutral-950 p-5">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span>
            <span className="block text-sm text-white">Fiche de garantie détachable</span>
            <span className="block text-xs text-neutral-500">Une fiche par appareil à la fin du contrat, que le client garde avec lui.</span>
          </span>
          <button
            role="switch"
            aria-checked={c.warrantyCard}
            onClick={() => update({ warrantyCard: !c.warrantyCard })}
            className={cn('relative w-11 h-6 rounded-full transition-colors shrink-0', c.warrantyCard ? 'bg-gold' : 'bg-neutral-700')}
          >
            <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', c.warrantyCard ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </label>
      </section>

      {/* Barre d'enregistrement */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className={cn('text-xs min-w-0', message ? (message.ok ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-500')}>
            {message?.ok && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />}
            {message?.text || (dirty ? 'Modifications non enregistrées' : saved.version ? `Version ${saved.version} en vigueur` : 'Modèle ZAFF en vigueur')}
          </p>
          <div className="flex gap-2 shrink-0">
            <button onClick={showPreview} disabled={previewing} className="h-11 px-4 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> {previewing ? '…' : 'Aperçu'}
            </button>
            <button
              onClick={submit}
              disabled={!dirty || save.isPending}
              className="h-11 px-5 rounded-2xl bg-gradient-to-r from-gold to-gold-deep text-ink font-bold text-sm disabled:opacity-40"
            >
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>

      {/* Aperçu */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 z-[80] bg-neutral-950/95 backdrop-blur-md overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-label="Aperçu du contrat"
          >
            <div className="sticky top-0 z-10 flex justify-end p-3">
              <button onClick={() => setPreview(null)} className="h-11 px-4 rounded-2xl bg-neutral-900 border border-neutral-700 text-white text-sm font-semibold flex items-center gap-1.5">
                <X className="w-4 h-4" /> Fermer l&apos;aperçu
              </button>
            </div>
            <div className="px-2 pb-10">
              <ContractDocument doc={preview} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeCard({ active, onClick, icon: Icon, title, text }: { active: boolean; onClick: () => void; icon: React.ElementType; title: string; text: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative text-left rounded-2xl border p-4 transition-colors',
        active ? 'border-gold bg-gold/10' : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600'
      )}
    >
      {active && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-gold" />}
      <Icon className={cn('w-5 h-5 mb-2', active ? 'text-gold-soft' : 'text-neutral-500')} />
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{text}</p>
    </button>
  );
}

const inputCls = 'w-full px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-gold';

function Field({ label, value, onChange, placeholder, max }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; max: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-300">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} className={cn(inputCls, 'h-11')} />
    </label>
  );
}

function Area({ label, value, onChange, rows, max }: { label: string; value: string; onChange: (v: string) => void; rows: number; max: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-300">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={max} className={cn(inputCls, 'py-2 leading-relaxed resize-y')} />
    </label>
  );
}
