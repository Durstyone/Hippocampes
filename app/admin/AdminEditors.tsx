import { useEffect, useId, useState, type ReactNode } from 'react';
import { Eye, FilePenLine, ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { AdminMedia, AdminNews, AdminPhoto } from '../../lib/github-admin';
import type { PublicEvent, PublicSiteSettings } from '../../lib/public-site-content';
import { mediaUrl } from '../../lib/site-delivery';

type EditorProps<T> = { value: T; onChange: (value: T) => void };
type ImageEditorProps<T> = EditorProps<T> & { media: AdminMedia[]; onPickImage?: () => void };
type FeaturedNews = PublicSiteSettings['featuredNews'][number];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="adm-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function imageSource(value: string) {
  if (!value || /[\\\s]/u.test(value) || value.startsWith('//')) return '';
  if (value.startsWith('/images/') || value.startsWith('/media/')) return mediaUrl(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function ImageField({ value, onChange, media = [], label = 'Photo', required = false, onPickImage, localOnly = false }: {
  value: string; onChange: (value: string) => void; media?: AdminMedia[]; label?: string; required?: boolean; onPickImage?: () => void; localOnly?: boolean;
}) {
  const source = imageSource(value);
  const hasCurrent = media.some(item => item.path === value);
  return <section className="adm-section">
    <Field label={label} hint="Choisissez une image de la photothèque ou renseignez son adresse.">
      <select value={value} onChange={event => onChange(event.target.value)} required={required}>
        <option value="">{required ? 'Choisir une photo' : 'Sans photo'}</option>
        {!!value && !hasCurrent && <option value={value}>Image actuelle</option>}
        {media.map(item => <option key={item.path} value={item.path}>{item.name}</option>)}
      </select>
    </Field>
    {source && <div className="adm-image-preview"><img src={source} alt="Aperçu de l’image sélectionnée" style={{ display: 'block', width: '100%', maxWidth: 320, maxHeight: 200, objectFit: 'contain', borderRadius: 10 }} /></div>}
    {onPickImage && <button className="adm-btn adm-btn-subtle" type="button" onClick={onPickImage}><ImagePlus size={17} />Choisir dans la photothèque</button>}
    <details className="adm-form-note"><summary>Utiliser une adresse d’image</summary>
      <Field label="Adresse de l’image" hint={localOnly ? 'Le chemin d’une image déjà présente dans la bibliothèque du site.' : 'Un chemin du site (/images/…) ou une adresse HTTPS.'}><input value={value} maxLength={2000} placeholder="/images/publications/photo.jpg" onChange={event => onChange(event.target.value)} /></Field>
    </details>
  </section>;
}

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function NewsEditor({ value, onChange, media, onPickImage }: ImageEditorProps<AdminNews>) {
  const [preview, setPreview] = useState(false);
  const set = <K extends keyof AdminNews>(key: K, next: AdminNews[K]) => onChange({ ...value, [key]: next });
  const source = imageSource(value.image);
  return <div className="adm-editor-content">
    <div className="adm-form-tabs" role="group" aria-label="Affichage de l’actualité">
      <button type="button" className={`adm-btn adm-btn-subtle${!preview ? ' active' : ''}`} aria-pressed={!preview} onClick={() => setPreview(false)}><FilePenLine size={17} />Rédiger</button>
      <button type="button" className={`adm-btn adm-btn-subtle${preview ? ' active' : ''}`} aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={17} />Aperçu</button>
    </div>
    {!preview && <div>
      <section className="adm-section">
        <Field label="Titre de l’actualité"><input value={value.title} required maxLength={220} placeholder="Une belle sortie avec le club" onChange={event => set('title', event.target.value)} /></Field>
        <Field label="Date affichée"><input type="date" value={value.date} required onChange={event => set('date', event.target.value)} /></Field>
        <Field label="Résumé" hint="Quelques phrases pour donner envie de lire l’article. Ce texte apparaît dans la liste des actualités."><textarea value={value.excerpt} required rows={3} maxLength={1200} onChange={event => set('excerpt', event.target.value)} /></Field>
      </section>
      <ImageField label="Photo de couverture" value={value.image} media={media} onChange={image => set('image', image)} onPickImage={onPickImage} />
      <section className="adm-section">
        <Field label="Texte de l’article" hint="Séparez les paragraphes par une ligne vide. Le texte est publié tel qu’il est rédigé, sans code HTML."><textarea value={value.body} required rows={13} onChange={event => set('body', event.target.value)} /></Field>
        <Field label="Lien complémentaire — facultatif" hint="Adresse HTTPS complète d’un album, d’un document ou d’une autre page."><input value={value.url} maxLength={2000} placeholder="https://…" onChange={event => set('url', event.target.value)} /></Field>
      </section>
    </div>}
    {preview && <article className="adm-preview" aria-label="Aperçu de l’actualité">
      <p className="adm-form-note">Aperçu avant enregistrement</p>
      {source && <img src={source} alt={value.title || 'Photo de couverture'} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12 }} />}
      <p>{value.date ? dateLabel(value.date) : 'Date à renseigner'}</p>
      <h2>{value.title || 'Le titre de votre actualité'}</h2>
      {value.excerpt && <p><strong>{value.excerpt}</strong></p>}
      {value.body.trim() ? value.body.split(/\n\s*\n/u).map((paragraph, index) => <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>) : <p className="adm-form-note">Le texte de votre article apparaîtra ici.</p>}
      {value.url && <p className="adm-form-note">Lien complémentaire : {value.url}</p>}
    </article>}
  </div>;
}

export function PhotoEditor({ value, onChange, media, onPickImage }: ImageEditorProps<AdminPhoto>) {
  const set = <K extends keyof AdminPhoto>(key: K, next: AdminPhoto[K]) => onChange({ ...value, [key]: next });
  return <div className="adm-editor-content">
    <ImageField value={value.image} media={media} onChange={image => set('image', image)} required localOnly onPickImage={onPickImage} />
    <section className="adm-section">
      <Field label="Titre de la photo"><input value={value.title} required maxLength={220} onChange={event => set('title', event.target.value)} /></Field>
      <Field label="Description de l’image" hint="Décrivez ce que l’on voit, pour les personnes qui utilisent un lecteur d’écran."><input value={value.alt} required maxLength={500} placeholder="Les membres du club au bord du bassin" onChange={event => set('alt', event.target.value)} /></Field>
      <div className="adm-grid-two">
        <Field label="Album" hint="Le même nom regroupe les photos d’une sortie."><input value={value.album} required maxLength={160} placeholder="Sortie à Conflans" onChange={event => set('album', event.target.value)} /></Field>
        <Field label="Date de la photo — facultatif"><input type="date" value={value.date} onChange={event => set('date', event.target.value)} /></Field>
      </div>
      <Field label="Légende — facultatif"><textarea value={value.description} rows={3} maxLength={2000} onChange={event => set('description', event.target.value)} /></Field>
      <div className="adm-grid-two">
        <Field label="Crédit photo — facultatif"><input value={value.credit || ''} maxLength={200} placeholder="Nom du photographe" onChange={event => set('credit', event.target.value)} /></Field>
        <Field label="Ordre dans l’album" hint="Les petits nombres apparaissent en premier."><input type="number" value={value.order} min={0} step={1} onChange={event => set('order', Number(event.target.value))} /></Field>
      </div>
    </section>
  </div>;
}

export function EventEditor({ value, onChange, season }: EditorProps<PublicEvent> & { season: PublicSiteSettings['season'] }) {
  const [scheduleType, setScheduleType] = useState<'dated' | 'regular'>(() => value.date ? 'dated' : value.dateLabel || value.dateValue ? 'regular' : 'dated');
  const radioName = useId();
  useEffect(() => { setScheduleType(value.date ? 'dated' : value.dateLabel || value.dateValue ? 'regular' : 'dated'); }, [value.id]);
  const set = <K extends keyof PublicEvent>(key: K, next: PublicEvent[K]) => onChange({ ...value, [key]: next });
  function changeSchedule(next: 'dated' | 'regular') {
    setScheduleType(next);
    onChange(next === 'regular'
      ? { ...value, date: '', endDate: '', dateLabel: value.dateLabel && !value.date ? value.dateLabel : 'CHAQUE', dateValue: value.dateValue && !value.date ? value.dateValue : '' }
      : { ...value, dateLabel: '', dateValue: '' });
  }
  return <div className="adm-editor-content">
    <section className="adm-section">
      <Field label="Nom du rendez-vous"><input value={value.title} required maxLength={220} placeholder="Entraînement apnée" onChange={event => set('title', event.target.value)} /></Field>
      <div className="adm-grid-two">
        <Field label="Rubrique du calendrier"><select value={value.calendarCategory} onChange={event => set('calendarCategory', event.target.value as PublicEvent['calendarCategory'])}><option value="piscine">Piscine et entraînement</option><option value="formation">Formation</option><option value="sortie">Sortie et voyage</option><option value="club">Vie du club</option><option value="ferie">Jour férié</option></select></Field>
        <Field label="Statut de la date"><select value={value.status} onChange={event => set('status', event.target.value as PublicEvent['status'])}><option value="scheduled">Au programme</option><option value="confirmed">Confirmé</option><option value="tentative">À confirmer</option></select></Field>
      </div>
      <Field label="Activité affichée" hint="Exemples : Formation N2, Apnée, Sortie club."><input value={value.category} required maxLength={100} onChange={event => set('category', event.target.value)} /></Field>
    </section>
    <section className="adm-section">
      <h3>Date et horaires</h3>
      <fieldset className="adm-schedule-choice"><legend>Type de rendez-vous</legend>
        <label><input type="radio" name={radioName} value="dated" checked={scheduleType === 'dated'} onChange={() => changeSchedule('dated')} /> Un événement daté</label>
        <label><input type="radio" name={radioName} value="regular" checked={scheduleType === 'regular'} onChange={() => changeSchedule('regular')} /> Un créneau habituel</label>
      </fieldset>
      {scheduleType === 'dated' ? <div className="adm-grid-two">
        <Field label="Date de début"><input type="date" value={value.date} min={season.startDate || undefined} max={season.endDate || undefined} required onChange={event => set('date', event.target.value)} /></Field>
        <Field label="Date de fin — facultatif" hint="Pour un événement sur plusieurs jours, indiquez le dernier jour inclus."><input type="date" value={value.endDate} min={value.date || season.startDate || undefined} max={season.endDate || undefined} onChange={event => set('endDate', event.target.value)} /></Field>
      </div> : <>
        <p className="adm-form-note">Ce créneau décrit les habitudes du club. Il ne crée pas automatiquement de séances dans le calendrier.</p>
        <div className="adm-grid-two">
          <Field label="Fréquence" hint="Par exemple : CHAQUE."><input value={value.dateLabel} required maxLength={40} onChange={event => set('dateLabel', event.target.value)} /></Field>
          <Field label="Jour ou repère" hint="Par exemple : MAR., JEU. ou sur demande."><input value={value.dateValue} required maxLength={24} onChange={event => set('dateValue', event.target.value)} /></Field>
        </div>
      </>}
      <div className="adm-grid-two">
        <Field label="Heure de début — facultatif"><input type="time" value={value.startTime} onChange={event => set('startTime', event.target.value)} /></Field>
        <Field label="Heure de fin — facultatif"><input type="time" value={value.endTime} onChange={event => set('endTime', event.target.value)} /></Field>
      </div>
      <p className="adm-form-note">Horaires à l’heure de Paris. Laissez vide si l’horaire reste à préciser.</p>
      <Field label="Précision sur l’horaire — facultatif" hint="Par exemple : rendez-vous à l’entrée de la piscine à 20 h 15."><input value={value.timeLabel} maxLength={160} onChange={event => set('timeLabel', event.target.value)} /></Field>
    </section>
    <section className="adm-section">
      <Field label="Lieu — facultatif"><input value={value.location} maxLength={300} placeholder="Piscine de Darnétal" onChange={event => set('location', event.target.value)} /></Field>
      <Field label="Présentation du rendez-vous"><textarea value={value.description} required maxLength={1200} rows={4} onChange={event => set('description', event.target.value)} /></Field>
      <details><summary>Détails complémentaires</summary>
        <Field label="Informations pour le calendrier" hint="Précisions incluses dans la fiche et l’export calendrier."><textarea value={value.calendarDescription} maxLength={2000} rows={4} onChange={event => set('calendarDescription', event.target.value)} /></Field>
        <Field label="Objet de la demande de renseignements" hint="Préremplit l’objet lorsque le visiteur contacte le club."><input value={value.contactSubject} maxLength={160} onChange={event => set('contactSubject', event.target.value)} /></Field>
        <Field label="Lien complémentaire"><input value={value.sourceUrl} maxLength={2000} placeholder="https://… ou /archives/…" onChange={event => set('sourceUrl', event.target.value)} /></Field>
      </details>
    </section>
  </div>;
}

export function FeaturedEditor({ value, onChange, media }: ImageEditorProps<FeaturedNews>) {
  const set = <K extends keyof FeaturedNews>(key: K, next: FeaturedNews[K]) => onChange({ ...value, [key]: next });
  return <div className="adm-editor-content">
    <p className="adm-form-note">Ce récit met en avant un article existant du blog ou des archives. Son lien est conservé.</p>
    <section className="adm-section">
      <Field label="Titre du récit"><input value={value.title} required maxLength={220} onChange={event => set('title', event.target.value)} /></Field>
      <div className="adm-grid-two">
        <Field label="Date affichée" hint="Par exemple : 1er avril 2026."><input value={value.date} required maxLength={80} onChange={event => set('date', event.target.value)} /></Field>
        <Field label="Rubrique"><select value={value.category} onChange={event => set('category', event.target.value)}><option>Vie du club</option><option>Les sorties</option></select></Field>
      </div>
      <Field label="Résumé"><textarea value={value.summary} required rows={4} maxLength={1200} onChange={event => set('summary', event.target.value)} /></Field>
    </section>
    <ImageField label="Photo du récit" value={value.image} media={media} required onChange={image => set('image', image)} />
    <section className="adm-section">
      <Field label="Description de la photo"><input value={value.alt} maxLength={500} onChange={event => set('alt', event.target.value)} /></Field>
      <Field label="Lien vers le récit"><input value={value.url} required maxLength={2000} placeholder="https://… ou /archives/…" onChange={event => set('url', event.target.value)} /></Field>
    </section>
  </div>;
}

export function ClubEditor({ value, onChange, tab }: EditorProps<PublicSiteSettings> & { tab: 'presentation' | 'contact' | 'season' | 'faq' }) {
  const contact = <K extends keyof PublicSiteSettings['contact']>(key: K, next: PublicSiteSettings['contact'][K]) => onChange({ ...value, contact: { ...value.contact, [key]: next } });
  const season = <K extends keyof PublicSiteSettings['season']>(key: K, next: PublicSiteSettings['season'][K]) => onChange({ ...value, season: { ...value.season, [key]: next } });
  const club = <K extends keyof PublicSiteSettings['club']>(key: K, next: PublicSiteSettings['club'][K]) => onChange({ ...value, club: { ...value.club, [key]: next } });
  if (tab === 'presentation') return <section className="adm-section">
    <h3>La présentation du club</h3>
    <Field label="Titre de la page Le club" hint="Une ligne par partie du titre, trois lignes maximum."><textarea value={value.club.titleLines.join('\n')} required rows={3} onChange={event => club('titleLines', event.target.value.split('\n'))} onBlur={event => club('titleLines', event.target.value.split('\n').map(line => line.trim()).filter(Boolean))} /></Field>
    <Field label="Texte de présentation" hint="Séparez les paragraphes par une ligne vide. Jusqu’à huit paragraphes."><textarea value={value.club.paragraphs.join('\n\n')} required rows={13} onChange={event => club('paragraphs', event.target.value.split(/\n\s*\n/u))} onBlur={event => club('paragraphs', event.target.value.split(/\n\s*\n/u).map(paragraph => paragraph.trim()).filter(Boolean))} /></Field>
  </section>;
  if (tab === 'contact') return <div className="adm-editor-content">
    <section className="adm-section">
      <h3>Les coordonnées</h3>
      <Field label="Adresse email du club"><input type="email" value={value.contact.email} required maxLength={180} onChange={event => contact('email', event.target.value)} /></Field>
      <div className="adm-grid-two">
        <Field label="Nom complet du lieu"><input value={value.contact.venue} required maxLength={160} onChange={event => contact('venue', event.target.value)} /></Field>
        <Field label="Nom court du lieu" hint="Utilisé dans les espaces plus compacts du site."><input value={value.contact.venueShort} required maxLength={120} onChange={event => contact('venueShort', event.target.value)} /></Field>
      </div>
      <Field label="Adresse" hint="Une ligne par élément : rue, code postal et ville."><textarea value={value.contact.addressLines.join('\n')} required rows={3} onChange={event => contact('addressLines', event.target.value.split('\n'))} onBlur={event => contact('addressLines', event.target.value.split('\n').map(line => line.trim()).filter(Boolean))} /></Field>
      <Field label="Lien du plan d’accès"><input type="url" value={value.contact.accessUrl} required maxLength={2000} placeholder="https://…" onChange={event => contact('accessUrl', event.target.value)} /></Field>
    </section>
    <section className="adm-section">
      <h3>Les entraînements</h3>
      <Field label="Jours d’entraînement"><input value={value.contact.trainingDays} required maxLength={120} placeholder="Mardi et jeudi" onChange={event => contact('trainingDays', event.target.value)} /></Field>
      <Field label="Horaires détaillés" hint="Un créneau par ligne, cinq lignes maximum."><textarea value={value.contact.hoursLines.join('\n')} required rows={4} onChange={event => contact('hoursLines', event.target.value.split('\n'))} onBlur={event => contact('hoursLines', event.target.value.split('\n').map(line => line.trim()).filter(Boolean))} /></Field>
      <Field label="Résumé des horaires" hint="Une formulation courte pour l’accueil du site."><input value={value.contact.hoursSummary} required maxLength={180} onChange={event => contact('hoursSummary', event.target.value)} /></Field>
    </section>
  </div>;
  if (tab === 'season') return <div className="adm-editor-content">
    <section className="adm-section">
      <h3>La saison du club</h3>
      <Field label="Nom de la saison"><input value={value.season.name} required maxLength={80} placeholder="2026–2027" onChange={event => season('name', event.target.value)} /></Field>
      <div className="adm-grid-two">
        <Field label="Premier jour"><input type="date" value={value.season.startDate} required max={value.season.endDate || undefined} onChange={event => season('startDate', event.target.value)} /></Field>
        <Field label="Dernier jour"><input type="date" value={value.season.endDate} required min={value.season.startDate || undefined} onChange={event => season('endDate', event.target.value)} /></Field>
      </div>
      <p className="adm-form-note">Les événements datés doivent être compris dans cette période. Les événements existants sont conservés lorsque vous modifiez la saison.</p>
      <Field label="Précision sous l’agenda"><textarea value={value.season.agendaNote} required rows={3} maxLength={1000} onChange={event => season('agendaNote', event.target.value)} /></Field>
      <Field label="Légende du dossier d’inscription"><input value={value.season.registrationCaption} required maxLength={300} onChange={event => season('registrationCaption', event.target.value)} /></Field>
    </section>
    <ImageField label="Image du programme de la saison" value={value.season.calendarImage} required onChange={image => season('calendarImage', image)} />
  </div>;
  function updateQuestion(index: number, patch: Partial<PublicSiteSettings['faq'][number]>) {
    onChange({ ...value, faq: value.faq.map((item, position) => position === index ? { ...item, ...patch } : item) });
  }
  return <section className="adm-section">
    <h3>Les questions fréquentes</h3>
    <p className="adm-form-note">Ces réponses apparaissent sur la page Le club.</p>
    {!value.faq.length && <p>Aucune question pour le moment.</p>}
    {value.faq.map((item, index) => <fieldset className="adm-repeat" key={index}>
      <legend>Question {index + 1}</legend>
      <Field label="Question"><input value={item.question} required maxLength={300} onChange={event => updateQuestion(index, { question: event.target.value })} /></Field>
      <Field label="Réponse"><textarea value={item.answer} required rows={4} maxLength={3000} onChange={event => updateQuestion(index, { answer: event.target.value })} /></Field>
      <button type="button" className="adm-btn adm-btn-danger" aria-label={`Retirer la question ${index + 1}`} onClick={() => onChange({ ...value, faq: value.faq.filter((_, position) => position !== index) })}><Trash2 size={16} />Retirer cette question</button>
    </fieldset>)}
    <button type="button" className="adm-btn adm-btn-subtle" disabled={value.faq.length >= 20} onClick={() => onChange({ ...value, faq: [...value.faq, { question: '', answer: '' }] })}><Plus size={17} />Ajouter une question</button>
    {value.faq.length >= 20 && <p className="adm-form-note">La page peut afficher jusqu’à 20 questions.</p>}
  </section>;
}
