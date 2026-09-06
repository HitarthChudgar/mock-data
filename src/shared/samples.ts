import type { FixtureMode, SampleId } from "./messages";

type SampleFactory = (mode: FixtureMode) => unknown;

const LONG = {
  firm: "Capital Group Companies, Inc. — Capital World Investors, Global Equity Division",
  holder: "The Vanguard Group, Inc. (Institutional Investor Group, Equity Index and Active Overlays)",
  name: "Alexandra Worthington-Hughes",
  title: "Senior Vice President, Investor Relations & Capital Markets Communications",
  event: "Morgan Stanley Global Healthcare Conference — Institutional Investor Track, Fireside & 1:1s",
  company: "Meridian Therapeutics plc (NASDAQ: MRDN), a clinical-stage biotechnology company",
};

function pick<T>(mode: FixtureMode, normal: T, long: T, missing: T): T {
  if (mode === "long") return long;
  if (mode === "missing") return missing;
  return normal;
}

const companies: SampleFactory = (mode) => ({
  company: {
    name: pick(mode, "Meridian Therapeutics", LONG.company, "Meridian Therapeutics"),
    ticker: "MRDN",
    sector: pick(mode, "Biotechnology", "Biotechnology · Immunology & Rare Disease", "Biotechnology"),
    marketCap: pick(mode, "$4.2B", "$4.18B fully diluted", null),
    price: pick(mode, "$48.16", "$48.16 +$0.66", "$48.16"),
    change: pick(mode, "+1.4%", "+1.38% vs prior close", null),
    irContact: pick(mode, "Sarah Chen", "Sarah Chen, VP Investor Relations", "Sarah Chen"),
    website: "investors.meridian.com",
  },
  companies: [
    {
      name: pick(mode, "Meridian Therapeutics", LONG.company, "Meridian Therapeutics"),
      ticker: "MRDN",
      sector: "Biotechnology",
      marketCap: pick(mode, "$4.2B", "$4.18B enterprise / $4.64B equity", "$4.2B"),
      price: "$48.16",
      change: pick(mode, "+1.4%", "+1.38%", null),
    },
    {
      name: pick(mode, "Helix Biopharma", "Helix Biopharma Holdings Limited — Oncology Franchise", "Helix Biopharma"),
      ticker: "HLXB",
      sector: "Biotechnology",
      marketCap: pick(mode, "$3.1B", "$3.06B", null),
      price: "$22.40",
      change: pick(mode, "-0.6%", "-0.62%", "-0.6%"),
    },
    {
      name: pick(mode, "Northstar Diagnostics", "Northstar Diagnostics, Inc. (Precision Screening)", "Northstar Diagnostics"),
      ticker: "NSTD",
      sector: "Diagnostics",
      marketCap: "$1.8B",
      price: "$15.02",
      change: pick(mode, "+0.3%", "+0.28% after-hours adjusted", "+0.3%"),
    },
    {
      name: pick(mode, "Cove Medical", "Cove Medical Devices Group plc", null),
      ticker: "COVE",
      sector: "Medical Devices",
      marketCap: "$2.4B",
      price: "$31.75",
      change: pick(mode, "+2.1%", "+2.11%", "+2.1%"),
    },
  ],
});

const institutions: SampleFactory = (mode) => ({
  asOf: "Jun 30, 2026",
  totalInstitutions: "214",
  institutionalOwnership: pick(mode, "62.4%", "62.4% of common shares outstanding", "62.4%"),
  investors: [
    {
      firm: pick(mode, "Capital Group", LONG.firm, "Capital Group"),
      ownership: pick(mode, "4.8%", "4.82% fully diluted", "4.8%"),
      change: pick(mode, "+0.6%", "+0.58 pp quarter over quarter", null),
      shares: pick(mode, "12.4M", "12,384,210 shares", "12.4M"),
      value: pick(mode, "$596M", "$596.4M reported fair value", "$596M"),
      style: "Active",
    },
    {
      firm: pick(mode, "Fidelity", "Fidelity Management & Research Company LLC", "Fidelity"),
      ownership: pick(mode, "3.2%", "3.18% of outstanding", null),
      change: pick(mode, "-0.2%", "-0.21 pp", "-0.2%"),
      shares: "8.3M",
      value: pick(mode, "$398M", "$397.8M", "$398M"),
      style: "Active",
    },
    {
      firm: pick(mode, "Vanguard", "The Vanguard Group, Inc.", "Vanguard"),
      ownership: pick(mode, "7.1%", "7.14% (index + active)", "7.1%"),
      change: pick(mode, "+0.1%", "+0.09 pp", "+0.1%"),
      shares: pick(mode, "18.2M", "18,221,904 shares", "18.2M"),
      value: pick(mode, "$876M", "$875.9M", null),
      style: "Passive",
    },
    {
      firm: pick(mode, "BlackRock", "BlackRock, Inc. — iShares & Active Equities", "BlackRock"),
      ownership: pick(mode, "6.4%", "6.41%", "6.4%"),
      change: pick(mode, "0.0%", "unchanged", "0.0%"),
      shares: "16.5M",
      value: "$794M",
      style: "Passive",
    },
    {
      firm: pick(mode, "T. Rowe Price", "T. Rowe Price Associates, Inc. — US Growth", "T. Rowe Price"),
      ownership: pick(mode, "2.1%", "2.14%", "2.1%"),
      change: pick(mode, "+0.4%", "+0.37 pp", "+0.4%"),
      shares: pick(mode, "5.4M", "5,402,118 shares", null),
      value: "$260M",
      style: "Active",
    },
    {
      firm: pick(mode, "Wellington", "Wellington Management Company LLP", "Wellington"),
      ownership: pick(mode, "1.8%", "1.76%", null),
      change: pick(mode, "-0.3%", "-0.31 pp", "-0.3%"),
      shares: "4.6M",
      value: pick(mode, "$222M", "$221.7M", "$222M"),
      style: "Active",
    },
  ],
});

const contacts: SampleFactory = (mode) => ({
  contacts: [
    {
      name: pick(mode, "Sarah Chen", LONG.name, "Sarah Chen"),
      title: pick(mode, "VP, Investor Relations", LONG.title, "VP, Investor Relations"),
      email: pick(mode, "sarah.chen@meridian.com", "sarah.chen@investors.meridian.com", null),
      phone: pick(mode, "+1 (617) 555-0142", "+1 (617) 555-0142 ext. 1800", "+1 (617) 555-0142"),
      region: "North America",
    },
    {
      name: pick(mode, "James Okonkwo", "James Adeyemi Okonkwo", "James Okonkwo"),
      title: pick(mode, "Director, IR", "Director, Investor Relations — Sell-side & Conferences", "Director, IR"),
      email: "james.okonkwo@meridian.com",
      phone: pick(mode, "+1 (617) 555-0194", "+1 (617) 555-0194", null),
      region: "North America",
    },
    {
      name: pick(mode, "Priya Raman", "Priya Raman-Sutcliffe", "Priya Raman"),
      title: pick(mode, "IR Manager, EMEA", "Investor Relations Manager, Europe & Middle East", "IR Manager, EMEA"),
      email: pick(mode, "priya.raman@meridian.com", "priya.raman@meridian.com", "priya.raman@meridian.com"),
      phone: "+44 20 7946 0138",
      region: pick(mode, "EMEA", "Europe, Middle East & Africa", "EMEA"),
    },
    {
      name: pick(mode, "Kenji Mori", "Kenji Mori", null),
      title: pick(mode, "IR, APAC", "Head of Investor Coverage, Asia Pacific", "IR, APAC"),
      email: "kenji.mori@meridian.com",
      phone: "+81 3 4550 2109",
      region: "APAC",
    },
  ],
});

const holdings: SampleFactory = (mode) => ({
  asOf: "Jun 30, 2026",
  holdings: [
    {
      holder: pick(mode, "Vanguard", LONG.holder, "Vanguard"),
      type: "13F",
      shares: pick(mode, "18.2M", "18,221,904", "18.2M"),
      percent: pick(mode, "7.1%", "7.14% of class", "7.1%"),
      value: pick(mode, "$876M", "$875,941,000", "$876M"),
      change: pick(mode, "+0.1%", "+142,000 shares", "+0.1%"),
    },
    {
      holder: pick(mode, "BlackRock", "BlackRock Fund Advisors / iShares", "BlackRock"),
      type: "13F",
      shares: "16.5M",
      percent: "6.4%",
      value: pick(mode, "$794M", "$794.2M", null),
      change: pick(mode, "0.0%", "no change", "0.0%"),
    },
    {
      holder: pick(mode, "Capital Group", LONG.firm, "Capital Group"),
      type: "13F",
      shares: "12.4M",
      percent: pick(mode, "4.8%", "4.82%", null),
      value: "$596M",
      change: pick(mode, "+0.6%", "+1.6M shares", "+0.6%"),
    },
    {
      holder: pick(mode, "State Street", "State Street Global Advisors", "State Street"),
      type: "13F",
      shares: pick(mode, "9.1M", "9,104,552", "9.1M"),
      percent: "3.5%",
      value: "$438M",
      change: pick(mode, "-0.1%", "-0.12 pp", "-0.1%"),
    },
    {
      holder: pick(mode, "Fidelity", "Fidelity Management & Research", "Fidelity"),
      type: pick(mode, "13F", "13F / 13G", "13F"),
      shares: "8.3M",
      percent: "3.2%",
      value: "$398M",
      change: pick(mode, "-0.2%", "-518,000 shares", null),
    },
  ],
});

const events: SampleFactory = (mode) => ({
  events: [
    {
      title: pick(mode, "Q2 2026 Earnings Call", "Second Quarter 2026 Financial Results Conference Call & Webcast", "Q2 2026 Earnings Call"),
      date: "Aug 12, 2026",
      time: pick(mode, "8:00 AM ET", "8:00–9:00 AM Eastern Time", "8:00 AM ET"),
      type: "Earnings",
      status: "Completed",
      location: pick(mode, "Webcast", "Live webcast + replay for 90 days", "Webcast"),
    },
    {
      title: pick(mode, "Morgan Stanley Healthcare", LONG.event, "Morgan Stanley Healthcare"),
      date: "Sep 9, 2026",
      time: "10:30 AM ET",
      type: "Conference",
      status: "Upcoming",
      location: pick(mode, "New York", "The Pierre, New York · Institutional track", "New York"),
    },
    {
      title: pick(mode, "R&D Day", "Research & Development Day — Pipeline Deep Dive and Q&A", "R&D Day"),
      date: "Oct 21, 2026",
      time: pick(mode, "9:00 AM ET", "9:00 AM–1:00 PM Eastern Time", null),
      type: "Investor Day",
      status: "Upcoming",
      location: pick(mode, "Boston", "Meridian HQ, Seaport, Boston", "Boston"),
    },
    {
      title: pick(mode, "JPM Healthcare 2027", "J.P. Morgan 45th Annual Healthcare Conference", "JPM Healthcare 2027"),
      date: "Jan 12, 2027",
      time: "11:00 AM PT",
      type: "Conference",
      status: pick(mode, "Upcoming", "Invitation only · upcoming", "Upcoming"),
      location: pick(mode, "San Francisco", "Westin St. Francis, San Francisco", null),
    },
    {
      title: pick(mode, "Q3 2026 Earnings Call", "Third Quarter 2026 Earnings Conference Call", "Q3 2026 Earnings Call"),
      date: "Nov 5, 2026",
      time: "8:00 AM ET",
      type: "Earnings",
      status: "Upcoming",
      location: "Webcast",
    },
  ],
});

const FACTORIES: Record<SampleId, SampleFactory> = {
  companies,
  institutions,
  contacts,
  holdings,
  events,
};

export const SAMPLE_OPTIONS: { id: SampleId; label: string }[] = [
  { id: "institutions", label: "Institutions" },
  { id: "companies", label: "Companies" },
  { id: "contacts", label: "Contacts" },
  { id: "holdings", label: "Holdings" },
  { id: "events", label: "Events" },
];

export function getSample(id: SampleId, mode: FixtureMode): unknown {
  return FACTORIES[id](mode);
}

export function getSampleText(id: SampleId, mode: FixtureMode): string {
  return `${JSON.stringify(getSample(id, mode), null, 2)}\n`;
}
