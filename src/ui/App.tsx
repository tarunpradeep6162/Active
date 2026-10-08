import { Nav } from './Nav';
import { Preloader, IntroHint, Manifesto, WorkPanel, LabLabel, LanternSkyLabel, FinaleSky, ActCard, EndCap, Contact, WebGLLost, NotFound } from './Sections';
import { useStore } from './useStore';
import { ChapterView } from '../birthday/ui/ChapterView';
import { CursorTrail } from './CursorTrail';
import { MidnightSurprise } from './Birthday';
import { FilmMode } from './FilmMode';
import { PaperFlower, OpeningCredits, EndCredits, FinaleTools, Replay, WindowSeat } from './Cinema';
import { startJournal } from './journal';
import { Intro } from './extras/Intro';
import { BirthdayGate } from './extras/BirthdayGate';
import { MorningBanner, WishTimer, ShakePetals } from './extras/Moments';
import { VoiceTulip } from './extras/VoiceTulip';
import { startHaptics } from './extras/haptics';
import { startPwa } from './extras/pwa';
import { recordVisit } from './extras/local';
import './extras/extras.css';

startJournal();
startHaptics();
startPwa();
recordVisit();
import '../birthday/ui/birthday.css';

export function App() {
  const revealed = useStore((s) => s.revealed);
  return (
    <>
      <Preloader />
      <Intro />
      {revealed && (
        <>
          <a className="sr-only sr-only-focusable" href="#ask-input">
            Skip to the garden's chapters
          </a>
          <main>
            <h1 className="sr-only">For Dheepika — a garden of memories, 25 · 11</h1>
            <IntroHint />
            <Manifesto />
            <WorkPanel />
            <LabLabel />
            <LanternSkyLabel />
            <FinaleSky />
            <ActCard />
            <EndCap />
          </main>
          <ChapterView />
          <Contact />
          <Nav />
          <div className="journey-line" aria-hidden="true" />
          <PaperFlower />
          <OpeningCredits />
          <FinaleTools />
          <EndCredits />
          <Replay />
          <WindowSeat />
          <MidnightSurprise />
          <FilmMode />
          <VoiceTulip />
          <MorningBanner />
          <WishTimer />
          <ShakePetals />
          <BirthdayGate />
        </>
      )}
      <WebGLLost />
      <NotFound />
      <CursorTrail />
    </>
  );
}
