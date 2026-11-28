import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ExternalLink, KeyRound, LoaderCircle, LockKeyhole, LogOut, Mail, RefreshCw, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { CLUB_ACCESS_OWNER, CLUB_ACCESS_REPOSITORIES, GitHubClubAccessClient, type ClubAccessResult, type ClubAccessScope, type ClubAccessSnapshot, type ClubAccessUser, type ClubInvitation } from '../../lib/github-club-access';
import './access-panel.css';

type MemberReference = { id: string; firstName: string; lastName: string; email: string };
type Confirmation = { kind: 'invite'; user: ClubAccessUser; scopes: ClubAccessScope[] } | { kind: 'remove'; user: ClubAccessUser; scope: ClubAccessScope } | { kind: 'cancel'; invitation: ClubInvitation; scope: ClubAccessScope };
const SCOPES: ClubAccessScope[] = ['site', 'private'];
const SCOPE_TITLE = { site: 'Gestion du site et de son code', private: 'Gestion des dossiers privés' };
const SCOPE_TEXT = {
  site: 'Modifier les actualités, les photos, les documents publics, l’agenda et tout le code du site, y compris le logiciel d’administration.',
  private: 'Consulter, modifier et télécharger toutes les fiches adhérents, les pièces nominatives et l’historique du dépôt privé.',
};
const RIGHTS_DOC = 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository';
const TOKEN_DOC = 'https://docs.github.com/fr/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens';
function message(error: unknown) { return error instanceof Error ? error.message : 'L’opération n’a pas pu être confirmée. Actualisez les accès.'; }
function Profile({ user }: { user: ClubAccessUser }) { return <div className="acc-profile">{user.avatarUrl ? <img src={user.avatarUrl} alt="" width="42" height="42"/> : <span className="acc-avatar"><Users size={21}/></span>}<span><strong>@{user.login}</strong>{user.name && <small>{user.name}</small>}</span><a href={user.profileUrl} target="_blank" rel="noopener noreferrer" className="adm-text-link" aria-label={`Vérifier le profil GitHub de ${user.login}`}><ExternalLink size={16}/><span>Profil</span></a></div>; }
function ConfirmDialog({ action, busy, error, onClose, onConfirm }: { action: Confirmation; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => { const element = ref.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); previous?.focus(); }; }, []);
  const user = action.kind === 'cancel' ? action.invitation.user : action.user;
  const title = action.kind === 'invite' ? 'Confirmer les accès à donner' : action.kind === 'remove' ? 'Retirer cet accès' : 'Annuler cette invitation';
  return <dialog className="adm-dialog acc-dialog" ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="adm-dialog-head"><h2>{title}</h2><button type="button" className="adm-icon-btn" onClick={onClose} disabled={busy} aria-label="Fermer la confirmation"><X size={20}/></button></div>
    <div className="adm-dialog-body acc-confirm-body">{user ? <Profile user={user}/> : <strong>Invitation #{action.kind === 'cancel' ? action.invitation.id : ''}</strong>}
      {action.kind === 'invite' ? <><p>Ce compte recevra une invitation GitHub pour chacun des périmètres cochés. Il devra l’accepter avant d’accéder au dépôt.</p><div className="acc-confirm-scopes">{action.scopes.map(scope => <section key={scope}><h3>{SCOPE_TITLE[scope]}</h3><p>{SCOPE_TEXT[scope]}</p><code>{CLUB_ACCESS_REPOSITORIES[scope]}</code></section>)}</div>
      {action.scopes.includes('site') && <p className="acc-important"><strong>Réservé à une personne de confiance.</strong> Le droit de modifier le site comprend le code de l’administration utilisée par les responsables. Ces périmètres ne constituent pas une séparation de sécurité face à un contributeur qui modifierait ce logiciel.</p>}
      <p>Ces dépôts appartiennent à un compte personnel : GitHub donne un accès de collaborateur en lecture et écriture. Il n’est pas possible de limiter ici une personne aux actualités, à certains documents, à une seule fiche adhérent ou à la lecture seule du dépôt privé.</p>
      <p>Les deux invitations sont envoyées séparément. Si l’une échoue, l’autre peut avoir été envoyée ; le résultat sera indiqué pour chaque dépôt.</p>
      <label className="acc-confirm-check"><input type="checkbox" checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)}/><span>J’ai vérifié ce compte GitHub et je confirme les accès décrits ci-dessus.</span></label></> : <><p>{action.kind === 'remove' ? 'Ce compte perdra son accès au périmètre suivant :' : 'Cette invitation sera annulée pour le périmètre suivant :'}</p><section className="acc-confirm-scope"><h3>{SCOPE_TITLE[action.scope]}</h3><code>{CLUB_ACCESS_REPOSITORIES[action.scope]}</code></section>{action.kind === 'remove' && <p>Les copies déjà téléchargées ne seront pas effacées. Les droits sur l’autre dépôt restent inchangés.</p>}<label className="acc-confirm-check"><input type="checkbox" checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)}/><span>Je confirme {action.kind === 'remove' ? 'le retrait de cet accès' : 'l’annulation de cette invitation'}.</span></label></>}
      {error && <p className="acc-message acc-error" role="alert">{error}</p>}
    </div><div className="adm-dialog-footer"><button type="button" className="adm-btn adm-btn-subtle" onClick={onClose} disabled={busy}>Annuler</button><button type="button" className="adm-btn" disabled={busy || !checked} onClick={onConfirm}>{busy ? <LoaderCircle className="acc-spin" size={17}/> : <ShieldCheck size={17}/>} {action.kind === 'invite' ? 'Envoyer les invitations' : action.kind === 'remove' ? 'Retirer l’accès' : 'Annuler l’invitation'}</button></div>
  </dialog>;
}

export function AccessPanel({ members = [], onBusyChange }: { members?: MemberReference[]; onBusyChange?: (busy: boolean) => void }) {
  const client = useRef<GitHubClubAccessClient | null>(null);
  const pending = useRef<GitHubClubAccessClient | null>(null);
  const epoch = useRef(0), lock = useRef(false);
  const [token, setToken] = useState('');
  const [snapshot, setSnapshot] = useState<ClubAccessSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [login, setLogin] = useState('');
  const [recipient, setRecipient] = useState<ClubAccessUser | null>(null);
  const [memberId, setMemberId] = useState('');
  const [selected, setSelected] = useState<Record<ClubAccessScope, boolean>>({ site: false, private: false });
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [results, setResults] = useState<ClubAccessResult[]>([]);
  const [resultTitle, setResultTitle] = useState('');
  const connected = !!snapshot && !!client.current;
  useEffect(() => () => { epoch.current++; client.current?.destroy(); pending.current?.destroy(); client.current = null; pending.current = null; }, []);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => { if (!busy) return; const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent); }, [busy]);
  function disconnect() {
    epoch.current++; client.current?.destroy(); pending.current?.destroy(); client.current = null; pending.current = null; lock.current = false;
    setToken(''); setSnapshot(null); setBusy(false); setError(''); setNotice(''); setLogin(''); setRecipient(null); setMemberId(''); setSelected({ site: false, private: false }); setConfirmation(null); setResults([]); setResultTitle('');
  }
  async function connect(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const current = ++epoch.current, credential = token.trim(); setToken('');
    let next: GitHubClubAccessClient | null = null;
    try {
      next = new GitHubClubAccessClient(credential); pending.current = next;
      await next.connect(); const value = await next.load();
      if (current !== epoch.current) return;
      client.current?.destroy(); client.current = next; pending.current = null; setSnapshot(value); setNotice('Compte propriétaire connecté. Les droits sont lus depuis GitHub.');
    } catch (failure) { next?.destroy(); if (current === epoch.current) { pending.current = null; setError(message(failure)); } }
    finally { if (current === epoch.current) { lock.current = false; setBusy(false); } }
  }
  async function refresh() {
    if (lock.current || !client.current) return;
    const api = client.current, current = epoch.current; lock.current = true; setBusy(true); setError('');
    try { const value = await api.load(); if (current === epoch.current) { setSnapshot(value); setNotice('Les accès ont été actualisés depuis GitHub.'); } }
    catch (failure) { if (current === epoch.current) setError(message(failure)); }
    finally { if (current === epoch.current) { lock.current = false; setBusy(false); } }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (lock.current || !client.current) return;
    const api = client.current, current = epoch.current; lock.current = true; setBusy(true); setError(''); setRecipient(null); setNotice(''); setResults([]);
    try { const user = await api.lookupUser(login); if (current === epoch.current) { setRecipient(user); setLogin(user.login); } }
    catch (failure) { if (current === epoch.current) setError(message(failure)); }
    finally { if (current === epoch.current) { lock.current = false; setBusy(false); } }
  }
  function prepareInvite() {
    if (!recipient || busy) return;
    const scopes = SCOPES.filter(scope => selected[scope]);
    if (!scopes.length) { setError('Choisissez au moins un périmètre.'); return; }
    setError(''); setConfirmation({ kind: 'invite', user: recipient, scopes });
  }
  async function apply() {
    if (lock.current || !client.current || !confirmation) return;
    const api = client.current, current = epoch.current, action = confirmation;
    lock.current = true; setBusy(true); setError(''); setNotice(''); setResults([]);
    try {
      const outcome = action.kind === 'invite' ? await api.invite(action.user, action.scopes) : action.kind === 'remove' ? [await api.removeCollaborator(action.scope, action.user)] : [await api.cancelInvitation(action.scope, action.invitation)];
      if (current !== epoch.current) return;
      setResults(outcome); setResultTitle(action.kind === 'invite' ? `Invitations pour @${action.user.login}` : 'Résultat de la modification'); setConfirmation(null);
      try { const latest = await api.load(); if (current === epoch.current) setSnapshot(latest); }
      catch { if (current === epoch.current) setNotice('Le résultat de chaque opération est affiché ci-dessous. Actualisez pour retrouver la liste à jour.'); }
    } catch (failure) { if (current === epoch.current) setError(message(failure)); }
    finally { if (current === epoch.current) { lock.current = false; setBusy(false); } }
  }
  const chosenMember = members.find(member => member.id === memberId);
  return <section className="acc-panel" aria-label="Droits d’accès au club">
    <div className="acc-intro"><span className="acc-large-icon"><ShieldCheck size={27}/></span><div><h2>Les responsables et leurs accès</h2><p>Donnez à certains membres un accès réel aux dépôts du club, avec leur propre compte GitHub.</p></div></div>
    <div className="acc-boundary"><strong>Deux périmètres, des droits de collaborateur</strong><p>Le propriétaire <b>Durstyone</b> peut autoriser la gestion du site et de son code, la gestion de tous les dossiers privés, ou les deux. Les fonctions « adhérent », « encadrant » et « trésorier » inscrites sur une fiche ne donnent aucun accès automatiquement.</p><p>L’accès au site comprend le code de l’administration : réservez-le à une personne de confiance. Des droits limités aux actualités, à une fiche ou à la lecture seule nécessitent une autre organisation des accès.</p><a href={RIGHTS_DOC} target="_blank" rel="noopener noreferrer" className="adm-text-link">Comprendre les droits GitHub</a></div>
    {!connected ? <section className="adm-panel acc-connect"><h3>Connexion du propriétaire</h3><p>Pour inviter, retirer ou consulter les responsables, utilisez le compte <strong>Durstyone</strong> avec un jeton à accès fin autorisé sur <strong>Hippocampes</strong> et <strong>Hippocampes-prive</strong>.</p><form onSubmit={connect}><label className="adm-field"><span>Jeton du propriétaire</span><input type="password" autoComplete="off" spellCheck={false} maxLength={270} required value={token} disabled={busy} placeholder="github_pat_…" onChange={event => setToken(event.target.value)}/><small>Permission Administration : Read and write sur les deux dépôts. Le jeton reste uniquement en mémoire dans cet onglet.</small></label>{error && <p className="acc-message acc-error" role="alert">{error}</p>}<button className="adm-btn" disabled={busy || !token.trim()} type="submit">{busy ? <LoaderCircle size={18} className="acc-spin"/> : <KeyRound size={18}/>} {busy ? 'Connexion…' : 'Ouvrir la gestion des droits'}</button></form><a href={TOKEN_DOC} target="_blank" rel="noopener noreferrer" className="adm-text-link">Guide des jetons GitHub</a></section> : <>
      <div className="acc-session"><span><LockKeyhole size={17}/>Propriétaire connecté : <strong>{CLUB_ACCESS_OWNER}</strong></span><div><button className="adm-btn adm-btn-subtle adm-btn-small" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15}/>Actualiser</button><button className="adm-btn adm-btn-subtle adm-btn-small" disabled={busy} onClick={disconnect}><LogOut size={15}/>Déconnecter</button></div></div>
      {error && !confirmation && <p className="acc-message acc-error" role="alert">{error}</p>}{notice && <p className="acc-message" role="status">{notice}</p>}
      {results.length > 0 && <section className="acc-results" aria-label="Résultat des droits"><h3>{resultTitle}</h3>{results.map(result => <div key={result.scope} className={result.outcome === 'failed' ? 'acc-result-failed' : ''}><strong>{SCOPE_TITLE[result.scope]}</strong><p>{result.message}</p></div>)}</section>}
      <section className="adm-panel acc-invite"><div className="acc-section-heading"><UserPlus size={23}/><div><h3>Donner un accès à un responsable</h3><p>Vérifiez son compte avant de choisir les périmètres.</p></div></div>
        {members.length > 0 && <label className="adm-field"><span>Repère dans la liste des adhérents — facultatif</span><select value={memberId} disabled={busy} onChange={event => { setMemberId(event.target.value); setRecipient(null); setLogin(''); }}><option value="">Choisir un adhérent</option>{members.map(member => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}</select><small>Ce choix sert de repère. Le compte GitHub n’est jamais déduit de l’adresse email et aucune association n’est enregistrée automatiquement.</small></label>}
        {chosenMember && <p className="acc-member-reference">Compte à vérifier pour <strong>{chosenMember.firstName} {chosenMember.lastName}</strong>.</p>}
        <form className="acc-lookup" onSubmit={verify}><label className="adm-field"><span>Identifiant GitHub du responsable</span><input autoComplete="off" spellCheck={false} maxLength={40} value={login} required disabled={busy} placeholder="Son identifiant GitHub" onChange={event => { setLogin(event.target.value); setRecipient(null); setResults([]); }}/></label><button type="submit" className="adm-btn adm-btn-subtle" disabled={busy || !login.trim()}><Search size={17}/>Vérifier le compte</button></form>
        {recipient && <div className="acc-recipient"><Profile user={recipient}/><span><Check size={15}/>Compte trouvé sur GitHub — vérifiez qu’il s’agit de la bonne personne.</span></div>}
        <div className="acc-scope-options">{SCOPES.map(scope => <label key={scope} className={`acc-scope-option ${selected[scope] ? 'selected' : ''}`}><input type="checkbox" disabled={busy} checked={selected[scope]} onChange={event => setSelected({ ...selected, [scope]: event.target.checked })}/><span><strong>{SCOPE_TITLE[scope]}</strong><small>{SCOPE_TEXT[scope]}</small></span></label>)}</div>
        <button type="button" className="adm-btn" disabled={busy || !recipient || !SCOPES.some(scope => selected[scope])} onClick={prepareInvite}><UserPlus size={18}/>Vérifier et confirmer les accès</button>
      </section>
      <div className="acc-repository-grid">{SCOPES.map(scope => { const data = snapshot[scope]; const collaborators = data.collaborators.filter(item => !item.owner); return <section className="adm-panel acc-repository" key={scope}><div className="acc-section-heading">{scope === 'private' ? <LockKeyhole size={22}/> : <Users size={22}/>}<div><h3>{SCOPE_TITLE[scope]}</h3><small>{data.repository}</small></div></div><h4>Accès actifs · {collaborators.length}</h4><p className="acc-owner"><ShieldCheck size={16}/>Durstyone — propriétaire</p>{collaborators.length ? <ul className="acc-access-list">{collaborators.map(item => <li key={item.user.id}><Profile user={item.user}/><span className="acc-access-status">Collaborateur · lecture et écriture</span><button className="adm-text-link" disabled={busy} onClick={() => { setError(''); setConfirmation({ kind: 'remove', user: item.user, scope }); }}>Retirer cet accès</button></li>)}</ul> : <p className="acc-empty">Le propriétaire est seul autorisé sur ce dépôt.</p>}<h4>Invitations en attente · {data.invitations.length}</h4>{data.invitations.length ? <ul className="acc-access-list">{data.invitations.map(invitation => <li key={invitation.id}>{invitation.user ? <Profile user={invitation.user}/> : <strong>Invitation #{invitation.id}</strong>}<span className="acc-access-status"><Mail size={14}/>À accepter sur GitHub</span><button className="adm-text-link" disabled={busy} onClick={() => { setError(''); setConfirmation({ kind: 'cancel', invitation, scope }); }}>Annuler cette invitation</button></li>)}</ul> : <p className="acc-empty">Aucune invitation en attente.</p>}</section>; })}</div>
    </>}
    <details className="acc-help"><summary>Comment les responsables invités utiliseront-ils cet accès ?</summary><p>Ils acceptent l’invitation sur GitHub avec leur propre compte. Ils peuvent ensuite travailler directement dans les dépôts autorisés.</p><p>Pour utiliser les formulaires de cette administration, GitHub impose actuellement aux collaborateurs de dépôts personnels appartenant à quelqu’un d’autre un <strong>jeton classique</strong> : portée <strong>public_repo</strong> pour le site public seul, ou <strong>repo</strong> pour les dossiers privés. Cette portée peut également donner accès à leurs autres dépôts ; elle ne se limite pas aux Hippocampes. Un jeton ne donne jamais plus de droits que ceux déjà attribués au compte.</p><p>Le propriétaire conserve la possibilité d’utiliser un jeton à accès fin limité aux deux dépôts. La gestion des invitations dans cet écran reste réservée à Durstyone.</p><a className="adm-text-link" href={TOKEN_DOC} target="_blank" rel="noopener noreferrer">Limites et fonctionnement des jetons GitHub</a></details>
    {confirmation && <ConfirmDialog action={confirmation} busy={busy} error={error} onClose={() => { if (!busy) { setConfirmation(null); setError(''); } }} onConfirm={() => void apply()}/>}
  </section>;
}
