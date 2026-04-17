import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getTemplates, updateTemplate, resetTemplate } from '../../api/adminService';
import { Settings as SettingsIcon, Save, RotateCcw, Loader2, Bell, Mail, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Paramètres Admin — Templates de notification
 */
export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const res = await getTemplates();
      const list = res.data.data?.templates || [];
      setTemplates(list);
      if (list.length > 0) setActiveTab(list[0].name);
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement templates.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(name, content) {
    setSaving(true);
    try {
      await updateTemplate(name, { content });
      toast.success('Template sauvegardé !');
    } catch (err) {
      toast.error(err.customMessage || 'Erreur sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(name) {
    if (!confirm('Réinitialiser ce template par défaut ?')) return;
    try {
      await resetTemplate(name);
      toast.success('Template réinitialisé.');
      loadTemplates();
    } catch (err) {
      toast.error(err.customMessage || 'Erreur réinitialisation.');
    }
  }

  function updateLocalTemplate(name, field, value) {
    setTemplates(prev => prev.map(t =>
      t.name === name ? { ...t, [field]: value } : t
    ));
  }

  const templateIcons = {
    expiry_reminder: Bell,
    payment_confirmation: Mail,
    welcome: MessageSquare,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const activeTemplate = templates.find(t => t.name === activeTab);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-dark-400 mt-1">Personnalisez les notifications de votre organisation</p>
      </div>

      {/* Templates de notification */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-brand-500/10">
            <SettingsIcon className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Templates de relance</h3>
            <p className="text-xs text-dark-400">Messages envoyés automatiquement à vos abonnés (texte brut, anti-XSS)</p>
          </div>
        </div>

        {templates.length === 0 ? (
          <p className="text-dark-400 text-sm text-center py-8">Aucun template configuré.</p>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {templates.map(t => {
                const Icon = templateIcons[t.name] || Bell;
                return (
                  <button
                    key={t.name}
                    onClick={() => setActiveTab(t.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      activeTab === t.name
                        ? 'bg-brand-600 text-white'
                        : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label || t.name}
                  </button>
                );
              })}
            </div>

            {/* Éditeur */}
            {activeTemplate && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-dark-300">Sujet</label>
                  <input
                    value={activeTemplate.subject || ''}
                    onChange={e => updateLocalTemplate(activeTab, 'subject', e.target.value)}
                    className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-dark-300">Contenu du message</label>
                  <textarea
                    value={activeTemplate.content || ''}
                    onChange={e => updateLocalTemplate(activeTab, 'content', e.target.value)}
                    rows={8}
                    className="w-full bg-dark-800 border border-dark-600 text-dark-100 placeholder-dark-500 rounded-lg px-4 py-3 text-sm font-mono resize-none
                      focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
                  />
                  <p className="text-xs text-dark-500">
                    Variables : {'{{nom}}'}, {'{{email}}'}, {'{{plan}}'}, {'{{date_expiration}}'}, {'{{montant}}'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button icon={Save} loading={saving} onClick={() => handleSave(activeTab, activeTemplate.content)}>
                    Sauvegarder
                  </Button>
                  <Button variant="ghost" icon={RotateCcw} onClick={() => handleReset(activeTab)}>
                    Réinitialiser
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
