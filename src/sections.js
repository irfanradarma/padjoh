export const SECTIONS = [
  { id: 1,  title: 'IT Governance',                                   short: 'IT Governance',        group: 'pre'  },
  { id: 2,  title: 'IT Governance Audit',                             short: 'IT Governance Audit',  group: 'pre'  },
  { id: 3,  title: 'IS Acquisition, Development & Implementation I',  short: 'IS Acq. & Dev. I',     group: 'pre'  },
  { id: 4,  title: 'IS Acquisition, Development & Implementation II', short: 'IS Acq. & Dev. II',    group: 'pre'  },
  { id: 5,  title: 'IS Operations & Business Resilience',             short: 'IS Operations',        group: 'pre'  },
  { id: 6,  title: 'Protection of Information Assets: Part A',        short: 'Info Assets A',        group: 'pre'  },
  { id: 7,  title: 'Protection of Information Assets: Part B',        short: 'Info Assets B',        group: 'pre'  },
  { id: 8,  title: 'UTS — Ujian Tengah Semester',                     short: 'UTS',                  group: 'pre'  },
  { id: 9,  title: 'Basic of Data Analysis',                          short: 'Data Analysis',        group: 'post' },
  { id: 10, title: 'Risk and Control',                                short: 'Risk & Control',       group: 'post' },
  { id: 11, title: 'Parallel Simulation',                             short: 'Parallel Simulation',  group: 'post' },
  { id: 12, title: 'Sampling and Statistical Approach',               short: 'Sampling',             group: 'post' },
  { id: 13, title: 'Substantive Testing',                             short: 'Substantive Testing',  group: 'post' },
  { id: 14, title: 'Intro to SQL for Auditors',                       short: 'Intro to SQL',         group: 'post' },
  { id: 15, title: 'Audit with SQL',                                  short: 'Audit with SQL',       group: 'post' },
  { id: 16, title: 'UAS — Ujian Akhir Semester',                      short: 'UAS',                  group: 'post' },
]

export const PRE_UTS  = SECTIONS.filter(s => s.group === 'pre')
export const POST_UTS = SECTIONS.filter(s => s.group === 'post')
