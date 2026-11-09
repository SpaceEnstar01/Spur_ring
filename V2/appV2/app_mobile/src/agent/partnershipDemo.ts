export type PartnershipStage =
  | 'matched'
  | 'draft'
  | 'awaiting_reply'
  | 'interested'
  | 'needs_information'
  | 'handed_over'
  | 'paused'
  | 'declined';
export type Prospect = {
  id: string;
  name: string;
  product: string;
  reason: string;
  stage: PartnershipStage;
  contact: string;
  subject: string;
  draft: string;
  reply: string;
  missing: string[];
  history: string[];
};
export const partnershipStageLabels: Record<PartnershipStage, string> = {
  matched: 'Brand match',
  draft: 'Draft ready',
  awaiting_reply: 'Awaiting reply',
  interested: 'Interested · Needs you',
  needs_information: 'Needs more information',
  handed_over: 'Marked for your follow-up',
  paused: 'Paused',
  declined: 'Not pursuing',
};
const outreach = (brand: string, product: string) =>
  `Hi ${brand} partnerships team,\n\nI’m [Creator Name], a creator exploring practical tools and experiences through personal, story-led videos. I’m planning a piece about how ${product.toLowerCase()} fits into a real creator’s day, including what works, what does not, and who it suits.\n\nI’d like to explore whether this could be a relevant partnership for ${brand}. A possible starting point is one dedicated video segment supported by a short practical demonstration, with the format and scope agreed together. The content would clearly disclose the partnership and retain an honest editorial perspective.\n\nIf you are open to discussing it, could you share your campaign objective, preferred timing, and indicative budget? I can then provide a verified media kit, availability, and an appropriate proposal.\n\nBest,\n[Creator Name]\n[Verified channel link]`;
function prospect(
  id: string,
  name: string,
  product: string,
  reason: string,
  stage: PartnershipStage,
): Prospect {
  return {
    id,
    name,
    product,
    reason,
    stage,
    contact: `${id}@example.com`,
    subject: `Partnership idea: ${product} in a creator’s real workflow`,
    draft: outreach(name, product),
    reply: '',
    missing: [
      'Verified contact and campaign brief',
      'Deliverable count and channels',
      'Budget and payment terms',
      'Content usage, exclusivity, and review requirements',
      'Creator availability and confirmed rate card',
    ],
    history: ['Fictional opportunity created for this demonstration.'],
  };
}
export const partnershipProspects: Prospect[] = [
  prospect(
    'luma',
    'Luma Gear',
    'Portable creator equipment',
    'A practical setup walkthrough could naturally demonstrate the product while preserving the creator’s honest opinion. This fit is an editorial hypothesis, not verified brand demand.',
    'draft',
  ),
  prospect(
    'morrow',
    'Morrow Desk',
    'Compact editing workspaces',
    'A workspace transformation could connect the product with a useful creator routine. Validate audience relevance before outreach.',
    'draft',
  ),
  prospect(
    'cedar',
    'Cedar Camera',
    'Lightweight camera accessories',
    'A field shoot could show a specific workflow trade-off rather than a generic product endorsement.',
    'draft',
  ),
  {
    ...prospect(
      'northline',
      'Northline Audio',
      'Creator microphones',
      'Audio comparisons fit a practical creator demonstration. The fictional reply below expresses interest in discussion, not a booked campaign.',
      'interested',
    ),
    subject: 'Re: A practical creator audio collaboration',
    reply:
      'Hi [Creator Name],\n\nWe are interested in discussing a video collaboration next month. Could you send your audience profile, a proposed format, and your rates?\n\nBest,\nNorthline Audio partnerships team',
    missing: [
      'Creator: confirm willingness, availability, and approved rates',
      'Brand: confirm budget, deliverables, and publishing window',
      'Both: agree usage rights, exclusivity, review process, and payment',
    ],
    history: [
      'Reference outreach prepared.',
      'A fictional interested reply was added to demonstrate triage.',
    ],
  },
  {
    ...prospect(
      'everyday',
      'Everyday Studio',
      'Everyday creator essentials',
      'The brand has asked for pricing in this fictional thread, but the scope is too unclear to quote responsibly.',
      'needs_information',
    ),
    reply: 'Hi, how much would you charge for a video?',
    subject: 'Re: Video collaboration scope',
    draft:
      'Hi Everyday Studio team,\n\nThanks for reaching out. Before I suggest an appropriate package, could you share the product, campaign objective, target platform, number of deliverables, and desired publishing window?\n\nPlease also let me know whether the content would be used in paid advertising, how long you would need usage rights, and whether you expect category exclusivity. An indicative budget would help me propose a suitable format.\n\nOnce the scope is clear, I can confirm availability and provide a quote for review.\n\nBest,\n[Creator Name]',
  },
  {
    ...prospect(
      'tidepack',
      'Tidepack',
      'Travel production bags',
      'There may be a travel-workflow angle, but a product mention alone is not enough to define a partnership.',
      'needs_information',
    ),
    reply:
      'We have a new bag launching soon. Would you be interested in working together?',
  },
  {
    ...prospect(
      'orbit',
      'Orbit Light',
      'Portable filming lights',
      'A portable-light demonstration could support a useful shooting lesson. Awaiting reply is a simulated state only.',
      'awaiting_reply',
    ),
    history: [
      'Outreach approved in the reference scenario.',
      'Simulated waiting state; no real message sent.',
    ],
  },
  prospect(
    'field',
    'Field Notes Studio',
    'Creative planning tools',
    'A project-planning workflow is a possible match. The contact, product fit, and commercial relevance would need verification before real outreach.',
    'matched',
  ),
];
export const partnershipProfile = [
  [
    'Content focus',
    'Reference focus: story-led creator tools and travel experiences. Replace with the creator’s confirmed positioning.',
  ],
  [
    'Audience & performance',
    'Not provided. No audience size, demographics, reach, or conversion claims may be inserted into a real email without verified data.',
  ],
  [
    'Available formats',
    'Proposed examples: dedicated segment, practical demonstration, or short-form adaptation. The creator must approve the actual package.',
  ],
  [
    'Commercial terms',
    'No approved quote, minimum fee, availability, usage-rights policy, or exclusivity terms supplied. Ask the creator before making commitments.',
  ],
  [
    'Source & contacts',
    'All eight brands, matches, and replies are fictional. example.com addresses are display placeholders, not verified recipients. No inbox was accessed.',
  ],
];
