'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingFlow from '@/components/onboarding';
import type { ProfileData } from '@/components/onboarding';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

const STEPS = ['Dati strutturali', 'Preferenze', 'Ambizione'];

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (user?.profileCompleted) {
    router.replace('/home');
    return null;
  }

  // Step 2
  const [naturalActivity, setNaturalActivity] = useState('');
  const [freeTimeActivity, setFreeTimeActivity] = useState('');

  // Step 3
  const [problemSolvingStyle, setProblemSolvingStyle] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('');
  const [careerVision, setCareerVision] = useState('');
  const [professionalGoal, setProfessionalGoal] = useState('');

  const canProceed = () => {
    switch (step) {
      case 0: return gpa && englishLevel && willingToRelocate;
      case 1: return naturalActivity && freeTimeActivity;
      case 2: return problemSolvingStyle && riskTolerance && careerVision && professionalGoal;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
  const handleComplete = async (profileData: ProfileData) => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await api.post('/profile/questionnaire', {
        yearOfStudy,
        gpa,
        englishLevel,
        willingToRelocate,
        naturalActivity,
        freeTimeActivity,
        problemSolvingStyle,
        riskTolerance,
        careerVision,
        professionalGoal,
      });
      if (user) setUser({ ...user, profileCompleted: true });
      router.push('/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il salvataggio. Riprova.');
      setSaving(false);
    }
  };

  return (
    <>
      <OnboardingFlow onComplete={handleComplete} />
      {error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-900/90 text-white px-4 py-3 rounded-xl text-sm text-center z-50">
          {error}
        </div>
      )}
    </>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= step ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
        )}

        <div className="card space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Anno di studi</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYearOfStudy(y)}
                      className={`flex-1 py-2 rounded-xl border text-sm transition-all ${
                        yearOfStudy === y
                          ? 'border-primary bg-primary/10 text-text-primary'
                          : 'border-border text-text-secondary hover:bg-card-hover'
                      }`}
                    >
                      {y}°
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Media voti</label>
                <div className="space-y-2">
                  <RadioOption value="GPA_18_20" current={gpa} onChange={setGpa} label="18-20" />
                  <RadioOption value="GPA_21_24" current={gpa} onChange={setGpa} label="21-24" />
                  <RadioOption value="GPA_25_27" current={gpa} onChange={setGpa} label="25-27" />
                  <RadioOption value="GPA_28_30" current={gpa} onChange={setGpa} label="28-30 e lode" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Livello di inglese</label>
                <div className="space-y-2">
                  <RadioOption value="A2" current={englishLevel} onChange={setEnglishLevel} label="A2 - Base" />
                  <RadioOption value="B1_B2" current={englishLevel} onChange={setEnglishLevel} label="B1/B2 - Intermedio" />
                  <RadioOption value="C1" current={englishLevel} onChange={setEnglishLevel} label="C1 - Avanzato" />
                  <RadioOption value="C2_PLUS" current={englishLevel} onChange={setEnglishLevel} label="C2+ - Madrelingua" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Disponibilità a trasferirti</label>
                <div className="space-y-2">
                  <RadioOption value="YES" current={willingToRelocate} onChange={setWillingToRelocate} label="Sì, sono disponibile" />
                  <RadioOption value="MAYBE" current={willingToRelocate} onChange={setWillingToRelocate} label="Forse, dipende dall'opportunità" />
                  <RadioOption value="NO" current={willingToRelocate} onChange={setWillingToRelocate} label="No, preferisco restare nella mia città" />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Quale attività ti viene più naturale?</label>
                <div className="space-y-2">
                  <RadioOption value="analizzare_dati" current={naturalActivity} onChange={setNaturalActivity} label="Analizzare dati e trovare pattern" />
                  <RadioOption value="creare_contenuti" current={naturalActivity} onChange={setNaturalActivity} label="Creare contenuti e design" />
                  <RadioOption value="organizzare_team" current={naturalActivity} onChange={setNaturalActivity} label="Organizzare persone e progetti" />
                  <RadioOption value="aiutare_altri" current={naturalActivity} onChange={setNaturalActivity} label="Aiutare gli altri e fare mentoring" />
                  <RadioOption value="risolvere_problemi" current={naturalActivity} onChange={setNaturalActivity} label="Risolvere problemi tecnici complessi" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Cosa fai in un pomeriggio libero?</label>
                <div className="space-y-2">
                  <RadioOption value="progetto_personale" current={freeTimeActivity} onChange={setFreeTimeActivity} label="Lavoro su un progetto personale" />
                  <RadioOption value="leggere_imparare" current={freeTimeActivity} onChange={setFreeTimeActivity} label="Leggo o imparo qualcosa di nuovo" />
                  <RadioOption value="socializzare" current={freeTimeActivity} onChange={setFreeTimeActivity} label="Esco con amici o conosco gente nuova" />
                  <RadioOption value="sport_natura" current={freeTimeActivity} onChange={setFreeTimeActivity} label="Sport o attività all'aperto" />
                  <RadioOption value="creare" current={freeTimeActivity} onChange={setFreeTimeActivity} label="Creo qualcosa (musica, arte, codice)" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Come affronti un problema?</label>
                <div className="space-y-2">
                  <RadioOption value="analitico" current={problemSolvingStyle} onChange={setProblemSolvingStyle} label="Analizzo tutti i dati prima di decidere" />
                  <RadioOption value="intuitivo" current={problemSolvingStyle} onChange={setProblemSolvingStyle} label="Mi fido del mio istinto" />
                  <RadioOption value="collaborativo" current={problemSolvingStyle} onChange={setProblemSolvingStyle} label="Ne parlo con gli altri" />
                  <RadioOption value="creativo" current={problemSolvingStyle} onChange={setProblemSolvingStyle} label="Cerco soluzioni non convenzionali" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Come ti senti con l'incertezza?</label>
                <div className="space-y-2">
                  <RadioOption value="alto" current={riskTolerance} onChange={setRiskTolerance} label="Mi entusiasma, amo l'adrenalina" />
                  <RadioOption value="medio" current={riskTolerance} onChange={setRiskTolerance} label="La gestisco bene se ho un piano B" />
                  <RadioOption value="basso" current={riskTolerance} onChange={setRiskTolerance} label="Preferisco avere certezze" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Come ti vedi tra 5 anni?</label>
                <div className="space-y-2">
                  <RadioOption value="leader" current={careerVision} onChange={setCareerVision} label="A capo di un team o progetto" />
                  <RadioOption value="imprenditore" current={careerVision} onChange={setCareerVision} label="Con la mia azienda o startup" />
                  <RadioOption value="creativo" current={careerVision} onChange={setCareerVision} label="In un ruolo creativo o innovativo" />
                  <RadioOption value="sociale" current={careerVision} onChange={setCareerVision} label="A fare la differenza nel sociale" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Qual è il tuo obiettivo professionale?</label>
                <div className="space-y-2">
                  <RadioOption value="crescita" current={professionalGoal} onChange={setProfessionalGoal} label="Crescita professionale rapida" />
                  <RadioOption value="impatto" current={professionalGoal} onChange={setProfessionalGoal} label="Avere un impatto positivo" />
                  <RadioOption value="liberta" current={professionalGoal} onChange={setProfessionalGoal} label="Libertà e flessibilità" />
                </div>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn-secondary flex-1"
              >
                Indietro
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Avanti
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceed() || loading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loading ? 'Salvataggio...' : 'Completa'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
