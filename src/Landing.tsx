import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Process from "./components/Process";
import Testimonials from "./components/Testimonials";
import Footer from "./components/Footer";
import { useLenis } from "./lib/useLenis";

export default function Landing() {
  useLenis();

  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero />
        <Process />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
