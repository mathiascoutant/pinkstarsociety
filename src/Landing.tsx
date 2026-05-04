import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Intro from "./components/Intro";
import Process from "./components/Process";
import Testimonials from "./components/Testimonials";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import { useLenis } from "./lib/useLenis";

export default function Landing() {
  useLenis();

  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero />
        <Intro />
        <Process />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
