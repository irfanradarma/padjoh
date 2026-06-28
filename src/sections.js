export const SECTIONS = [
  { id: 1,  title: 'IT Governance: Concept',                   short: 'IT Gov: Concept',     group: 'pre'  },
  { id: 2,  title: 'IT Governance: Audit Program',             short: 'IT Gov: Audit Prog.', group: 'pre'  },
  { id: 3,  title: 'IS Acquisition and Development',           short: 'IS Acq. & Dev.',      group: 'pre'  },
  { id: 4,  title: 'IS Implementation',                        short: 'IS Implementation',   group: 'pre'  },
  { id: 5,  title: 'Practicum on Domain 3',                    short: 'Practicum D3',        group: 'pre'  },
  { id: 6,  title: 'Navigating International Standards (GTAG)', short: 'Intl Standards',     group: 'pre'  },
  { id: 7,  title: 'Mid-Term Exam Prep',                       short: 'UTS Prep',            group: 'pre'  },
  { id: 8,  title: 'Mid-Term Exam',                            short: 'Mid-Term Exam',       group: 'pre'  },
  { id: 9,  title: 'IS Operation & Business Resilience I',     short: 'IS Operations I',     group: 'post' },
  { id: 10, title: 'IS Operation & Business Resilience II',    short: 'IS Operations II',    group: 'post' },
  { id: 11, title: 'Protection of Information Assets I',       short: 'Info Assets I',       group: 'post' },
  { id: 12, title: 'Protection of Information Assets II',      short: 'Info Assets II',      group: 'post' },
  { id: 13, title: 'Intro to SQL for Auditing',                short: 'Intro to SQL',        group: 'post' },
  { id: 14, title: 'Case Study: Auditing with SQL',            short: 'SQL Case Study',      group: 'post' },
  { id: 15, title: 'Final Exam Prep',                          short: 'UAS Prep',            group: 'post' },
  { id: 16, title: 'Final Exam',                               short: 'Final Exam',          group: 'post' },
]

export const PRE_UTS  = SECTIONS.filter(s => s.group === 'pre')
export const POST_UTS = SECTIONS.filter(s => s.group === 'post')
