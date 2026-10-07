import { useState, useEffect, useRef } from 'react';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch, getDocs,
  type DocumentData,
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  type User,
} from 'firebase/auth';
import { db, auth } from './firebase';

export interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  bio: string;
  photo: string;
  linkedin: string;
  twitter: string;
  skills: string[];
  yearsAtCompany: number;
  location: string;
  order: number;
}

// Only used for the optional "Seed sample data" button in the admin panel.
const SAMPLE_STAFF: Omit<StaffMember, 'id'>[] = [
  {
    name: 'Amara Okonkwo',
    position: 'Chief Executive Officer',
    department: 'Executive',
    email: 'amara.okonkwo@company.com',
    phone: '+1 (555) 001-0001',
    bio: "Amara brings over 18 years of leadership experience in technology and operations. She has driven the company's expansion into international markets and champions a culture of innovation and integrity.",
    photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&h=700&fit=crop&auto=format',
    linkedin: 'linkedin.com/in/amara-okonkwo',
    twitter: '@amaraokonkwo',
    skills: ['Strategic Leadership', 'Operations', 'Business Development'],
    yearsAtCompany: 9,
    location: 'New York, NY',
    order: 1,
  },
  {
    name: 'Daniel Mercer',
    position: 'Chief Technology Officer',
    department: 'Engineering',
    email: 'daniel.mercer@company.com',
    phone: '+1 (555) 001-0002',
    bio: 'Daniel leads all engineering initiatives and technical strategy. With a background in distributed systems and machine learning, he ensures the company stays at the cutting edge of technology.',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=700&fit=crop&auto=format',
    linkedin: 'linkedin.com/in/daniel-mercer',
    twitter: '@danielmercer_tech',
    skills: ['System Architecture', 'Machine Learning', 'Cloud Infrastructure'],
    yearsAtCompany: 6,
    location: 'San Francisco, CA',
    order: 2,
  },
  {
    name: 'Sofia Reyes',
    position: 'Head of Design',
    department: 'Design',
    email: 'sofia.reyes@company.com',
    phone: '+1 (555) 001-0003',
    bio: 'Sofia shapes every visual and experiential touchpoint of our products. Her human-centered design philosophy has earned the company multiple industry awards.',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=700&fit=crop&auto=format',
    linkedin: 'linkedin.com/in/sofia-reyes-design',
    twitter: '@sofiareyes',
    skills: ['Product Design', 'UX Research', 'Brand Identity'],
    yearsAtCompany: 4,
    location: 'Austin, TX',
    order: 3,
  },
  {
    name: 'Marcus Chen',
    position: 'VP of Sales',
    department: 'Sales',
    email: 'marcus.chen@company.com',
    phone: '+1 (555) 001-0004',
    bio: 'Marcus has built and scaled sales teams across three continents. His consultative approach and deep market knowledge have consistently delivered above-target revenue growth.',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=700&fit=crop&auto=format',
    linkedin: 'linkedin.com/in/marcus-chen',
    twitter: '@marcuschen_sales',
    skills: ['Enterprise Sales', 'Team Building', 'Market Strategy'],
    yearsAtCompany: 5,
    location: 'Chicago, IL',
    order: 4,
  },
];

// ─── Firestore data layer ───────────────────────────────────────────────────

const STAFF_COL = 'staff';

/** Defensive mapper so partial/legacy docs never break the UI. */
function toStaff(id: string, d: DocumentData): StaffMember {
  return {
    id,
    name: d.name ?? '',
    position: d.position ?? '',
    department: d.department ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    bio: d.bio ?? '',
    photo: d.photo ?? '',
    linkedin: d.linkedin ?? '',
    twitter: d.twitter ?? '',
    skills: Array.isArray(d.skills) ? d.skills : [],
    yearsAtCompany: Number(d.yearsAtCompany) || 0,
    location: d.location ?? '',
    order: Number(d.order) || 0,
  };
}

/**
 * Real-time staff hook.
 * Subscribes to the `staff` collection and re-renders on every remote change —
 * from this tab, another tab, or another user entirely.
 */
function useStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, STAFF_COL), orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        setStaff(snapshot.docs.map(d => toStaff(d.id, d.data())));
        setError(null);
        setLoading(false);
      },
      err => {
        console.error('[staff] listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe; // detach listener on unmount
  }, []);

  const addStaff = async (member: Omit<StaffMember, 'id' | 'order'>) => {
    const nextOrder = staff.reduce((max, m) => Math.max(max, m.order), 0) + 1;
    await addDoc(collection(db, STAFF_COL), {
      ...member,
      order: nextOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const updateStaff = async (id: string, member: Partial<StaffMember>) => {
    const payload: Record<string, unknown> = { ...member };
    delete payload.id; // never store the doc id inside the doc
    await updateDoc(doc(db, STAFF_COL, id), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteStaff = async (id: string) => {
    await deleteDoc(doc(db, STAFF_COL, id));
  };

  return { staff, loading, error, addStaff, updateStaff, deleteStaff };
}

/** Writes the sample team into an empty collection. Safe to call repeatedly. */
async function seedSampleStaff() {
  const existing = await getDocs(collection(db, STAFF_COL));
  if (!existing.empty) return;

  const batch = writeBatch(db);
  SAMPLE_STAFF.forEach(m => {
    batch.set(doc(collection(db, STAFF_COL)), {
      ...m,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// ─── Barcode SVG ────────────────────────────────────────────────────────────

function Barcode({ seed }: { seed: string }) {
  const bars = Array.from({ length: 36 }, (_, i) => {
    const char = seed.charCodeAt(i % seed.length);
    return ((char * (i + 7) * 13) % 5) + 1;
  });
  const total = bars.reduce((a, b) => a + b + 1, 0);
  let x = 0;
  return (
    <svg width="100%" height="28" viewBox={`0 0 ${total} 28`} preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {bars.map((w, i) => {
        const rx = x;
        x += w + 1;
        return i % 3 !== 1 ? (
          <rect key={i} x={rx} y={0} width={w} height={28} fill="currentColor" />
        ) : null;
      })}
    </svg>
  );
}

// ─── ID Card ─────────────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, { stripe: string; label: string }> = {
  Executive:   { stripe: '#C9A84C', label: '#0A0A0A' },
  Engineering: { stripe: '#4C8BC9', label: '#ffffff' },
  Design:      { stripe: '#9B4CC9', label: '#ffffff' },
  Sales:       { stripe: '#4CC97A', label: '#0A0A0A' },
  Marketing:   { stripe: '#C94C4C', label: '#ffffff' },
  Finance:     { stripe: '#4CC9C9', label: '#0A0A0A' },
  HR:          { stripe: '#C97A4C', label: '#ffffff' },
  Operations:  { stripe: '#8BC94C', label: '#0A0A0A' },
};

function getDeptColor(dept: string) {
  return DEPT_COLORS[dept] ?? { stripe: '#C9A84C', label: '#0A0A0A' };
}

function employeeId(id: string, order: number) {
  return `EMP-${String(order).padStart(3, '0')}-${id.slice(-4).toUpperCase()}`;
}

function IDCard({ member, onClick }: { member: StaffMember; onClick: () => void }) {
  const deptColor = getDeptColor(member.department);

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none"
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative transition-all duration-300 group-hover:-translate-y-2"
        style={{
          width: '100%',
          borderRadius: '10px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.8)',
        }}
      >
        {/* Card body */}
        <div
          style={{
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #2A2A2A',
            backgroundColor: '#141414',
          }}
        >
          {/* Top color stripe */}
          <div style={{ height: '6px', backgroundColor: deptColor.stripe }} />

          {/* Header row */}
          <div
            className="flex items-center justify-between px-4 pt-3 pb-2"
            style={{ borderBottom: '1px solid #1E1E1E' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center text-xs font-bold"
                style={{
                  width: 22, height: 22,
                  backgroundColor: deptColor.stripe,
                  color: deptColor.label,
                  borderRadius: '3px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '9px',
                  letterSpacing: '0.05em',
                }}
              >
                CO
              </div>
              <span
                className="text-xs tracking-[0.1em] uppercase"
                style={{ color: '#3A3330', fontWeight: 500, fontSize: '9px' }}
              >
                Company Inc.
              </span>
            </div>
            <span
              className="text-xs"
              style={{
                color: '#2A2A2A',
                fontSize: '8px',
                letterSpacing: '0.05em',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              STAFF ID
            </span>
          </div>

          {/* Photo + info */}
          <div className="flex gap-3 p-4">
            <div
              className="shrink-0 overflow-hidden"
              style={{
                width: 72, height: 90,
                borderRadius: '4px',
                border: '1px solid #2A2A2A',
                backgroundColor: '#1A1A1A',
              }}
            >
              <img
                src={member.photo || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=250&fit=crop&auto=format`}
                alt={member.name}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=250&fit=crop&auto=format`;
                }}
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h3
                  className="font-display leading-tight mb-0.5"
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    color: '#F2EDE4',
                    fontSize: '15px',
                    fontWeight: 700,
                  }}
                >
                  {member.name}
                </h3>
                <p
                  className="leading-snug"
                  style={{ color: '#8A7D6E', fontSize: '10px', fontWeight: 400, marginBottom: '6px' }}
                >
                  {member.position}
                </p>
                <span
                  className="inline-block text-xs px-1.5 py-0.5"
                  style={{
                    backgroundColor: `${deptColor.stripe}18`,
                    color: deptColor.stripe,
                    border: `1px solid ${deptColor.stripe}33`,
                    borderRadius: '3px',
                    fontSize: '8px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {member.department}
                </span>
              </div>

              {member.location && (
                <p style={{ color: '#3A3330', fontSize: '9px', letterSpacing: '0.06em' }}>
                  📍 {member.location}
                </p>
              )}
            </div>
          </div>

          <div style={{ height: '1px', backgroundColor: '#1A1A1A', margin: '0 16px' }} />

          {/* Employee ID row */}
          <div className="flex items-center justify-between px-4 py-2">
            <div>
              <p style={{ color: '#2A2A2A', fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1px' }}>Employee ID</p>
              <p style={{ color: '#4A4038', fontSize: '9px', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                {employeeId(member.id, member.order)}
              </p>
            </div>
            {member.yearsAtCompany > 0 && (
              <div className="text-right">
                <p style={{ color: '#2A2A2A', fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1px' }}>Tenure</p>
                <p style={{ color: '#4A4038', fontSize: '9px' }}>{member.yearsAtCompany} yr{member.yearsAtCompany !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          {/* Barcode */}
          <div className="px-4 pb-3" style={{ color: '#1E1E1E' }}>
            <Barcode seed={member.id + member.name} />
            <p
              className="text-center mt-1"
              style={{ color: '#1E1E1E', fontSize: '7px', letterSpacing: '0.2em', fontFamily: 'monospace' }}
            >
              {(member.id + member.name.replace(/\s/g, '')).toUpperCase().slice(0, 18)}
            </p>
          </div>
        </div>

        {/* Hover glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            borderRadius: '10px',
            boxShadow: `0 0 0 1px ${deptColor.stripe}40, 0 8px 32px ${deptColor.stripe}15`,
          }}
        />
      </div>
    </button>
  );
}

// ─── Staff Detail Modal ─────────────────────────────────────────────────────

function StaffModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#111111', border: '1px solid #272727', borderRadius: '10px' }}
      >
        <div
          style={{
            borderRadius: '10px 10px 0 0',
            overflow: 'hidden',
            borderBottom: '1px solid #1E1E1E',
          }}
        >
          <div style={{ height: '8px', backgroundColor: getDeptColor(member.department).stripe }} />

          <div className="flex gap-5 p-6" style={{ backgroundColor: '#0E0E0E' }}>
            <div
              className="shrink-0 overflow-hidden"
              style={{
                width: 100, height: 126,
                borderRadius: '6px',
                border: '2px solid #2A2A2A',
                backgroundColor: '#1A1A1A',
              }}
            >
              <img
                src={member.photo || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&auto=format`}
                alt={member.name}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&auto=format`;
                }}
              />
            </div>

            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="flex items-center justify-center font-bold"
                    style={{
                      width: 24, height: 24,
                      backgroundColor: getDeptColor(member.department).stripe,
                      color: getDeptColor(member.department).label,
                      borderRadius: '4px',
                      fontSize: '9px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    CO
                  </div>
                  <span style={{ color: '#2A2A2A', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Company Inc.</span>
                  <span style={{ color: '#1E1E1E', fontSize: '9px' }}>·</span>
                  <span style={{ color: '#2A2A2A', fontSize: '9px', letterSpacing: '0.1em' }}>STAFF ID CARD</span>
                </div>

                <h2 className="font-display leading-tight mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4', fontSize: '22px', fontWeight: 700 }}>
                  {member.name}
                </h2>
                <p className="mb-3" style={{ color: '#8A7D6E', fontSize: '12px' }}>{member.position}</p>
                <span
                  className="inline-block px-2 py-0.5"
                  style={{
                    backgroundColor: `${getDeptColor(member.department).stripe}18`,
                    color: getDeptColor(member.department).stripe,
                    border: `1px solid ${getDeptColor(member.department).stripe}33`,
                    borderRadius: '3px',
                    fontSize: '9px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {member.department}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p style={{ color: '#2A2A2A', fontSize: '7px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '2px' }}>Employee ID</p>
                  <p style={{ color: '#4A4038', fontSize: '11px', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                    {employeeId(member.id, member.order)}
                  </p>
                </div>
                <div className="w-32" style={{ color: '#1E1E1E' }}>
                  <Barcode seed={member.id + member.name} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 flex flex-col gap-6">
          <p className="text-sm leading-relaxed" style={{ color: '#B8AE9C' }}>
            {member.bio}
          </p>

          <div className="grid grid-cols-1 gap-3">
            {member.email && (
              <div className="flex items-center gap-3">
                <span className="text-xs tracking-widest uppercase w-16 shrink-0" style={{ color: '#4A4038' }}>Email</span>
                <a href={`mailto:${member.email}`} className="text-sm hover:underline" style={{ color: '#C9A84C' }}>
                  {member.email}
                </a>
              </div>
            )}
            {member.phone && (
              <div className="flex items-center gap-3">
                <span className="text-xs tracking-widest uppercase w-16 shrink-0" style={{ color: '#4A4038' }}>Phone</span>
                <span className="text-sm" style={{ color: '#B8AE9C' }}>{member.phone}</span>
              </div>
            )}
            {member.location && (
              <div className="flex items-center gap-3">
                <span className="text-xs tracking-widest uppercase w-16 shrink-0" style={{ color: '#4A4038' }}>Office</span>
                <span className="text-sm" style={{ color: '#B8AE9C' }}>{member.location}</span>
              </div>
            )}
            {member.yearsAtCompany > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs tracking-widest uppercase w-16 shrink-0" style={{ color: '#4A4038' }}>Tenure</span>
                <span className="text-sm" style={{ color: '#B8AE9C' }}>{member.yearsAtCompany} {member.yearsAtCompany === 1 ? 'year' : 'years'}</span>
              </div>
            )}
          </div>

          {member.skills.length > 0 && (
            <div>
              <p className="text-xs tracking-[0.12em] uppercase mb-3" style={{ color: '#4A4038', fontWeight: 500 }}>Expertise</p>
              <div className="flex flex-wrap gap-2">
                {member.skills.map(skill => (
                  <span
                    key={skill}
                    className="text-xs px-3 py-1"
                    style={{ border: '1px solid #272727', color: '#8A7D6E', borderRadius: '2px' }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-2">
            {member.linkedin && (
              <a href={`https://${member.linkedin}`} target="_blank" rel="noopener noreferrer"
                className="text-xs tracking-widest uppercase hover:underline transition-colors"
                style={{ color: '#C9A84C' }}>
                LinkedIn
              </a>
            )}
            {member.twitter && (
              <a href={`https://twitter.com/${member.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="text-xs tracking-widest uppercase hover:underline transition-colors"
                style={{ color: '#C9A84C' }}>
                Twitter
              </a>
            )}
          </div>
        </div>

        <div className="border-t flex justify-end px-8 py-4" style={{ borderColor: '#1E1E1E' }}>
          <button
            onClick={onClose}
            className="text-xs tracking-[0.15em] uppercase px-5 py-2 transition-all"
            style={{ border: '1px solid #272727', color: '#6B6155', borderRadius: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C', e.currentTarget.style.color = '#C9A84C')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#272727', e.currentTarget.style.color = '#6B6155')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Public Directory Page ──────────────────────────────────────────────────

function PublicPage({
  staff,
  loading,
  error,
  onAdminClick,
}: {
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  onAdminClick: () => void;
}) {
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [filter, setFilter] = useState('All');

  const departments = ['All', ...Array.from(new Set(staff.map(s => s.department).filter(Boolean)))];
  const filtered = filter === 'All' ? staff : staff.filter(s => s.department === filter);
  const sorted = [...filtered].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      <header className="border-b sticky top-0 z-40" style={{ borderColor: '#1C1C1C', backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl tracking-wide" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4' }}>
              Our People
            </h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: '#4A4038' }}>Company Directory</p>
          </div>
          <button
            onClick={onAdminClick}
            className="text-xs tracking-[0.12em] uppercase px-4 py-2 transition-all"
            style={{ border: '1px solid #272727', color: '#4A4038', borderRadius: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C', e.currentTarget.style.color = '#C9A84C')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#272727', e.currentTarget.style.color = '#4A4038')}
          >
            Admin
          </button>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A84C', fontWeight: 500 }}>
            Meet the Team
          </p>
          <h2 className="font-display text-5xl md:text-6xl leading-[1.05] mb-6" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4' }}>
            The people behind<br />
            <em>the work</em>
          </h2>
          <p className="text-base leading-relaxed" style={{ color: '#6B6155', maxWidth: '480px' }}>
            A collective of thinkers, builders, and leaders dedicated to delivering exceptional outcomes for our clients and communities.
          </p>
        </div>
      </section>

      {!loading && departments.length > 1 && (
        <div className="max-w-7xl mx-auto px-6 pb-10">
          <div className="flex gap-1 flex-wrap">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setFilter(dept)}
                className="text-xs tracking-[0.12em] uppercase px-4 py-2 transition-all"
                style={{
                  borderRadius: '2px',
                  border: `1px solid ${filter === dept ? '#C9A84C' : '#1C1C1C'}`,
                  color: filter === dept ? '#C9A84C' : '#4A4038',
                  backgroundColor: filter === dept ? 'rgba(201,168,76,0.08)' : 'transparent',
                }}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{ height: 300, backgroundColor: '#111111', border: '1px solid #1C1C1C', borderRadius: '10px' }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <p className="text-sm mb-2" style={{ color: '#ef4444' }}>Could not load the directory.</p>
            <p className="text-xs" style={{ color: '#4A4038' }}>{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm" style={{ color: '#4A4038' }}>No staff members found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" style={{ alignItems: 'start' }}>
            {sorted.map(member => (
              <IDCard key={member.id} member={member} onClick={() => setSelected(member)} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t" style={{ borderColor: '#1C1C1C' }}>
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="text-xs" style={{ color: '#2A2A2A' }}>© {new Date().getFullYear()} Company Directory</p>
          <p className="text-xs" style={{ color: '#2A2A2A' }}>Scan QR · View Profiles</p>
        </div>
      </footer>

      {selected && <StaffModal member={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Staff Form ─────────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<StaffMember, 'id' | 'order'> = {
  name: '', position: '', department: '', email: '', phone: '',
  bio: '', photo: '', linkedin: '', twitter: '', skills: [], yearsAtCompany: 0, location: '',
};

function StaffForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: StaffMember;
  onSave: (data: Omit<StaffMember, 'id' | 'order'>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<StaffMember, 'id' | 'order'>>(
    initial ? { ...initial } : { ...EMPTY_FORM }
  );
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const field = (key: keyof typeof form) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s)) {
      setForm(prev => ({ ...prev, skills: [...prev.skills, s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) =>
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.position.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err) {
      console.error('[staff] save failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm transition-all rounded-none";
  const inputStyle = {
    backgroundColor: '#0F0F0F',
    border: '1px solid #272727',
    color: '#F2EDE4',
    borderRadius: '2px',
  };
  const labelStyle = { color: '#4A4038', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' };

  return (
    <div
      className="rounded-sm p-8 max-w-2xl mx-auto"
      style={{ backgroundColor: '#0F0F0F', border: '1px solid #1C1C1C' }}
    >
      <h3 className="font-display text-2xl mb-8" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4' }}>
        {initial ? 'Edit Profile' : 'Add Staff Member'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label style={labelStyle}>Full Name *</label>
          <input className={inputClass} style={inputStyle} placeholder="Jane Smith" {...field('name')} />
        </div>
        <div>
          <label style={labelStyle}>Position *</label>
          <input className={inputClass} style={inputStyle} placeholder="Senior Engineer" {...field('position')} />
        </div>
        <div>
          <label style={labelStyle}>Department</label>
          <input className={inputClass} style={inputStyle} placeholder="Engineering" {...field('department')} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input className={inputClass} style={inputStyle} type="email" placeholder="jane@company.com" {...field('email')} />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input className={inputClass} style={inputStyle} placeholder="+1 555 000 0000" {...field('phone')} />
        </div>
        <div>
          <label style={labelStyle}>Location / Office</label>
          <input className={inputClass} style={inputStyle} placeholder="New York, NY" {...field('location')} />
        </div>
        <div>
          <label style={labelStyle}>Years at Company</label>
          <input className={inputClass} style={inputStyle} type="number" min="0"
            value={form.yearsAtCompany}
            onChange={e => setForm(prev => ({ ...prev, yearsAtCompany: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle}>Photo URL</label>
          <input className={inputClass} style={inputStyle} placeholder="https://images.unsplash.com/..." {...field('photo')} />
          {form.photo && (
            <div className="mt-2 flex items-center gap-3">
              <img src={form.photo} alt="Preview" className="w-12 h-14 object-cover" style={{ borderRadius: '2px' }}
                onError={e => (e.currentTarget.style.display = 'none')} />
              <span className="text-xs" style={{ color: '#4A4038' }}>Preview</span>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle}>Bio</label>
          <textarea
            className={inputClass}
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={4}
            placeholder="A short professional biography..."
            value={form.bio}
            onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
          />
        </div>
        <div>
          <label style={labelStyle}>LinkedIn (URL path)</label>
          <input className={inputClass} style={inputStyle} placeholder="linkedin.com/in/username" {...field('linkedin')} />
        </div>
        <div>
          <label style={labelStyle}>Twitter / X Handle</label>
          <input className={inputClass} style={inputStyle} placeholder="@handle" {...field('twitter')} />
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle}>Skills / Expertise</label>
          <div className="flex gap-2">
            <input
              className={inputClass}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Add a skill and press Enter"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-4 py-2 text-xs tracking-widest uppercase transition-all"
              style={{ border: '1px solid #C9A84C', color: '#C9A84C', borderRadius: '2px', backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(201,168,76,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Add
            </button>
          </div>
          {form.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.skills.map(skill => (
                <span
                  key={skill}
                  className="text-xs px-3 py-1 flex items-center gap-2"
                  style={{ border: '1px solid #272727', color: '#8A7D6E', borderRadius: '2px' }}
                >
                  {skill}
                  <button onClick={() => removeSkill(skill)} className="hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <p className="mt-6 text-xs" style={{ color: '#ef4444' }}>{saveError}</p>
      )}

      <div className="flex gap-3 mt-8 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs tracking-widest uppercase px-5 py-2 transition-all disabled:opacity-40"
          style={{ border: '1px solid #272727', color: '#4A4038', borderRadius: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F2EDE4')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4A4038')}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs tracking-widest uppercase px-6 py-2 transition-all disabled:opacity-60"
          style={{ backgroundColor: '#C9A84C', color: '#0A0A0A', borderRadius: '2px', fontWeight: 600 }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D4B35A')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#C9A84C')}
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Member'}
        </button>
      </div>
    </div>
  );
}

// ─── Admin Page ─────────────────────────────────────────────────────────────

function AdminPage({
  staff,
  onAdd,
  onUpdate,
  onDelete,
  onSeed,
  onSignOut,
  onBack,
}: {
  staff: StaffMember[];
  onAdd: (m: Omit<StaffMember, 'id' | 'order'>) => Promise<void>;
  onUpdate: (id: string, m: Partial<StaffMember>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSeed: () => Promise<void>;
  onSignOut: () => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...staff].sort((a, b) => a.order - b.order);

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await onDelete(id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('[staff] delete failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      <header className="border-b sticky top-0 z-40" style={{ borderColor: '#1C1C1C', backgroundColor: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-xs tracking-[0.12em] uppercase flex items-center gap-2 transition-colors"
              style={{ color: '#4A4038' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4A4038')}
            >
              ← Directory
            </button>
            <span style={{ color: '#1C1C1C' }}>|</span>
            <h1 className="font-display text-lg" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4' }}>Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1" style={{ border: '1px solid #C9A84C22', color: '#C9A84C', borderRadius: '2px', backgroundColor: 'rgba(201,168,76,0.06)' }}>
              {staff.length} members
            </span>
            <button
              onClick={onSignOut}
              className="text-xs tracking-[0.12em] uppercase px-3 py-1.5 transition-all"
              style={{ border: '1px solid #272727', color: '#4A4038', borderRadius: '2px' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#7f1d1d', e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#272727', e.currentTarget.style.color = '#4A4038')}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {view === 'list' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-3xl" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4' }}>
                Staff Members
              </h2>
              <button
                onClick={() => setView('add')}
                className="text-xs tracking-[0.12em] uppercase px-5 py-2 transition-all flex items-center gap-2"
                style={{ backgroundColor: '#C9A84C', color: '#0A0A0A', borderRadius: '2px', fontWeight: 600 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D4B35A')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#C9A84C')}
              >
                + Add Member
              </button>
            </div>

            <div className="space-y-3">
              {sorted.length === 0 && (
                <div className="py-16 text-center border" style={{ borderColor: '#1C1C1C', borderRadius: '2px' }}>
                  <p className="text-sm mb-4" style={{ color: '#4A4038' }}>No staff members yet.</p>
                  <div className="flex items-center justify-center gap-6">
                    <button onClick={() => setView('add')} className="text-xs tracking-widest uppercase" style={{ color: '#C9A84C' }}>
                      Add the first one
                    </button>
                    <button
                      onClick={async () => { setBusy(true); try { await onSeed(); } finally { setBusy(false); } }}
                      disabled={busy}
                      className="text-xs tracking-widest uppercase disabled:opacity-40"
                      style={{ color: '#4A4038' }}
                    >
                      {busy ? 'Seeding…' : 'Seed sample data'}
                    </button>
                  </div>
                </div>
              )}
              {sorted.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 transition-colors"
                  style={{ backgroundColor: '#0F0F0F', border: '1px solid #1C1C1C', borderRadius: '2px' }}
                >
                  <div className="w-12 h-14 shrink-0 bg-[#1a1a1a] overflow-hidden" style={{ borderRadius: '2px' }}>
                    <img
                      src={member.photo || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=250&fit=crop`}
                      alt={member.name}
                      className="w-full h-full object-cover"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#F2EDE4' }}>{member.name}</p>
                    <p className="text-xs truncate" style={{ color: '#6B6155' }}>{member.position}</p>
                    <p className="text-xs" style={{ color: '#4A4038' }}>{member.department}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditing(member); setView('edit'); }}
                      className="text-xs tracking-widest uppercase px-3 py-1.5 transition-all"
                      style={{ border: '1px solid #272727', color: '#6B6155', borderRadius: '2px' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C', e.currentTarget.style.color = '#C9A84C')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#272727', e.currentTarget.style.color = '#6B6155')}
                    >
                      Edit
                    </button>
                    {confirmDelete === member.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(member.id)}
                          disabled={busy}
                          className="text-xs tracking-widest uppercase px-3 py-1.5 transition-all disabled:opacity-50"
                          style={{ border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: '2px' }}
                        >
                          Confirm
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1.5" style={{ color: '#4A4038' }}>
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(member.id)}
                        className="text-xs tracking-widest uppercase px-3 py-1.5 transition-all"
                        style={{ border: '1px solid #272727', color: '#3D3330', borderRadius: '2px' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#7f1d1d', e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#272727', e.currentTarget.style.color = '#3D3330')}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'add' && (
          <StaffForm
            onSave={async data => { await onAdd(data); setView('list'); }}
            onCancel={() => setView('list')}
          />
        )}

        {view === 'edit' && editing && (
          <StaffForm
            initial={editing}
            onSave={async data => { await onUpdate(editing.id, data); setView('list'); setEditing(null); }}
            onCancel={() => { setView('list'); setEditing(null); }}
          />
        )}
      </main>
    </div>
  );
}

// ─── Admin Login (Firebase Auth) ────────────────────────────────────────────

function AdminLogin({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const attempt = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess();
    } catch (err: any) {
      const code = err?.code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Invalid email or password.'
          : code === 'auth/too-many-requests'
            ? 'Too many attempts. Try again shortly.'
            : err?.message ?? 'Sign in failed.',
      );
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="text-xs tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontWeight: 500 }}>Admin Access</p>
          <h2 className="font-display text-4xl mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#F2EDE4' }}>
            Staff Directory
          </h2>
          <p className="text-sm" style={{ color: '#4A4038' }}>Sign in with your admin account.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-xs tracking-widest uppercase" style={{ color: '#4A4038' }}>Email</label>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              placeholder="admin@company.com"
              autoComplete="username"
              className="w-full px-4 py-3 text-sm transition-all"
              style={{
                backgroundColor: '#0F0F0F',
                border: `1px solid ${error ? '#ef4444' : '#272727'}`,
                color: '#F2EDE4',
                borderRadius: '2px',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label className="block mb-2 text-xs tracking-widest uppercase" style={{ color: '#4A4038' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-4 py-3 text-sm transition-all"
              style={{
                backgroundColor: '#0F0F0F',
                border: `1px solid ${error ? '#ef4444' : '#272727'}`,
                color: '#F2EDE4',
                borderRadius: '2px',
                outline: 'none',
              }}
            />
            {error && <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>{error}</p>}
          </div>

          <button
            onClick={attempt}
            disabled={busy}
            className="w-full py-3 text-xs tracking-[0.15em] uppercase transition-all font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#C9A84C', color: '#0A0A0A', borderRadius: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D4B35A')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#C9A84C')}
          >
            {busy ? 'Signing in…' : 'Enter'}
          </button>

          <button
            onClick={onBack}
            className="w-full py-2 text-xs tracking-widest uppercase transition-colors"
            style={{ color: '#2A2A2A' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#4A4038')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2A2A2A')}
          >
            Back to Directory
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────

type AppView = 'public' | 'login' | 'admin';

export default function App() {
  const { staff, loading, error, addStaff, updateStaff, deleteStaff } = useStaff();
  const [view, setView] = useState<AppView>('public');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Keeps the admin session alive across reloads.
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthReady(true);
      if (!u) setView(v => (v === 'admin' ? 'public' : v));
    });
  }, []);

  const goAdmin = () => setView(user ? 'admin' : 'login');

  const handleSignOut = async () => {
    await signOut(auth);
    setView('public');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#4A4038' }}>Loading…</p>
      </div>
    );
  }

  return (
    <>
      {view === 'public' && (
        <PublicPage staff={staff} loading={loading} error={error} onAdminClick={goAdmin} />
      )}
      {view === 'login' && (
        <AdminLogin
          onSuccess={() => setView('admin')}
          onBack={() => setView('public')}
        />
      )}
      {view === 'admin' && user && (
        <AdminPage
          staff={staff}
          onAdd={addStaff}
          onUpdate={updateStaff}
          onDelete={deleteStaff}
          onSeed={seedSampleStaff}
          onSignOut={handleSignOut}
          onBack={() => setView('public')}
        />
      )}
    </>
  );
}
