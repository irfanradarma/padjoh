import { useState } from 'react'
import { SECTIONS } from '../sections'
import NotesTab from './tabs/NotesTab'
import ExerciseTab from './tabs/ExerciseTab'
import ActivitiesTab from './tabs/ActivitiesTab'

const TABS = [
  { id: 'notes',      label: '📝 Notes'      },
  { id: 'exercise',   label: '📎 Exercise'   },
  { id: 'activities', label: '⭐ Activities' },
]

export default function ClassPage({ sectionId, session, profile }) {
  const [activeTab, setActiveTab] = useState('notes')
  const section = SECTIONS.find(s => s.id === sectionId)
  const group   = section?.group === 'pre' ? 'Pre-UTS' : 'Post-UTS'

  return (
    <div className="page-content">
      <div className="page-breadcrumb">
        {group} › <span>Sesi {sectionId}</span>
      </div>
      <div className="page-header">
        <h2>{section?.title}</h2>
        <p>Information System Audit — jurnal kelas</p>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'notes'      && <NotesTab      sectionId={sectionId} userId={session.user.id} />}
      {activeTab === 'exercise'   && <ExerciseTab   sectionId={sectionId} userId={session.user.id} />}
      {activeTab === 'activities' && <ActivitiesTab sectionId={sectionId} userId={session.user.id} profile={profile} />}
    </div>
  )
}
