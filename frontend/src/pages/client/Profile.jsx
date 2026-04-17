import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { getProfile, updateProfile } from '../../api/clientService';
import { User, Mail, Phone, Building2, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Page Profil Client — Édition des informations personnelles
 */
export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    company: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await getProfile();
      const u = res.data.data.user;
      setProfile(res.data.data);
      setForm({
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        phone: u.phone || '',
        gender: u.gender || '',
        company: u.company || '',
      });
    } catch (err) {
      toast.error(err.customMessage || 'Erreur chargement profil.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success('Profil mis à jour !');
    } catch (err) {
      toast.error(err.customMessage || 'Erreur mise à jour.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Mon profil</h1>
        <p className="text-dark-400 mt-1">Gérez vos informations personnelles</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Prénom"
              icon={User}
              placeholder="Jean"
              value={form.firstName}
              onChange={handleChange('firstName')}
            />
            <Input
              label="Nom de famille"
              icon={User}
              placeholder="Mbemba"
              value={form.lastName}
              onChange={handleChange('lastName')}
            />
          </div>

          <Input
            label="Email"
            type="email"
            icon={Mail}
            value={form.email}
            onChange={handleChange('email')}
          />

          <Input
            label="Téléphone"
            icon={Phone}
            placeholder="+242 06 XXX XXXX"
            value={form.phone}
            onChange={handleChange('phone')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-dark-300">Sexe</label>
              <select
                value={form.gender}
                onChange={handleChange('gender')}
                className="w-full bg-dark-800 border border-dark-600 text-dark-100 rounded-lg px-4 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
              >
                <option value="">Non spécifié</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <Input
              label="Entreprise"
              icon={Building2}
              placeholder="Nom de votre entreprise"
              value={form.company}
              onChange={handleChange('company')}
            />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={saving} icon={Save}>
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Card>

      {/* Info compte */}
      {profile && (
        <Card className="!bg-dark-800/30">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Informations du compte</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-dark-500">Rôle</span>
            <span className="text-dark-200 font-medium">{profile.user?.role}</span>
            <span className="text-dark-500">Code parrainage</span>
            <span className="text-brand-400 font-mono font-medium">{profile.user?.referral_code}</span>
            <span className="text-dark-500">Membre depuis</span>
            <span className="text-dark-200">{new Date(profile.user?.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
