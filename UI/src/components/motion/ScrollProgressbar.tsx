import { motion, useScroll } from "motion/react";

export function ScrollProgressbar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
        className="fixed left-0 top-0 h-1 bg-primary z-50 origin-left"
        style={{ scaleX: scrollYProgress, width: "100%" }}
      />
  );
}