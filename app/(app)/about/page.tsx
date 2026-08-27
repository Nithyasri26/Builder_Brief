import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, PageHeader } from '@/components/ui';
import { PRODUCT } from '@/lib/config';
import { demoCitizen } from '@/data/demo/citizen';

export const metadata: Metadata = { title: 'About this app' };

const CAN = [
  'Understand what you need, in your own words',
  'Explain what a service asks for, in simple language',
  'Look for government help that may suit you',
  'Use papers you already have, instead of asking again',
  'Fill in an application and keep your place if you stop',
  'Keep everything in one list and tell you what changed',
];

const CANNOT = [
  'Send a real application to a government office',
  'Move money or take a payment',
  'Book a real train ticket',
  'Decide for certain whether you can get something',
  'Open your real Aadhaar, PAN, UAN or DigiLocker account',
  'Do anything important without you tapping Confirm first',
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="About this app" description={PRODUCT.tagline} />

      <div className="space-y-4">
        <Card className="border-wait/30 bg-wait-soft">
          <CardBody>
            <h2 className="text-[15px] font-semibold text-wait">This is a practice app</h2>
            <p className="mt-1 text-[15px] text-wait">
              Everything in it is a sample: the person, the papers, the money and the connections to
              government services. Nothing you do here reaches a real government office, and no real
              Aadhaar, PAN, UAN, payment or OTP is used at any point.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">Why this exists</h2>
            <p className="text-[15px] text-ink-muted">
              India already has a lot of government services online. The hard part is knowing which
              office handles what you need, what the service is called, which form to fill, which
              papers to carry, and where to check what happened afterwards.
            </p>
            <p className="text-[15px] text-ink-muted">
              NammaSahaay lets you say what you need in your own words and does that part for you. It
              is built to sit on top of the services that already exist, not to replace them. It is
              made independently and is not run by, or connected to, any government body.
            </p>
          </CardBody>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardBody>
              <h2 className="text-[15px] font-semibold text-ok">What it does</h2>
              <ul className="mt-2 space-y-1.5 text-[15px] text-ink-muted">
                {CAN.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="text-[15px] font-semibold text-stop">What it does not do</h2>
              <ul className="mt-2 space-y-1.5 text-[15px] text-ink-muted">
                {CANNOT.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">The person in this app</h2>
            <p className="text-[15px] text-ink-muted">
              Every screen uses one made-up person. She does not exist, and no real personal
              information is used anywhere.
            </p>
            <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
              <Row label="Name" value={demoCitizen.name} />
              <Row label="Age" value={`${demoCitizen.age}`} />
              <Row label="Lives in" value={`${demoCitizen.city}, ${demoCitizen.state}`} />
              <Row label="Situation" value="Widowed, one child, not working right now" />
              <Row label="Her numbers" value="Made-up numbers, not real ones" />
              <Row label="Her papers" value="Sample files, not issued by anyone" />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">The support programmes you see</h2>
            <p className="text-[15px] text-ink-muted">
              Most of the programmes in this app are written as examples, so you can see how matching
              and applying would work. A few real government programmes are listed too — those are
              marked <strong>Government programme</strong> and link to the official website. For
              those, only the government can say who is eligible, so this app does not guess.
            </p>
            <p className="text-[15px] text-ink-muted">
              Anything that matters should be checked on the official service before you rely on it.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-[15px] font-semibold text-ink">Start again</h2>
            <p className="text-[15px] text-ink-muted">
              Use “Start again” at the bottom of the menu to clear everything you have done here and
              go back to the beginning.
            </p>
            <Link href="/" className="text-[15px] font-medium text-accent hover:underline">
              Back to the conversation
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="text-ink-muted">{value}</dd>
    </div>
  );
}
