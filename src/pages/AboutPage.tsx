import Footer from "../components/Footer";
import Intro from "../components/Intro";
import Navbar from "../components/Navbar";
import { useLenis } from "../lib/useLenis";

export default function AboutPage() {
  useLenis();

  return (
    <div className="relative">
      <Navbar />
      <main>
        <Intro />
      </main>
      <Footer />
    </div>
  );
}
