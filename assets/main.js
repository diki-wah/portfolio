(() => {
  const typed = document.getElementById("typed");
  const phrases = [
    "python automate --everything",
    "scan --onchain --find-opps",
    "ship() // repeat",
  ];
  let pi = 0, ci = 0, deleting = false;

  function typeLoop() {
    if (!typed) return;
    const phrase = phrases[pi];
    typed.textContent = phrase.slice(0, ci);
    let wait = 70;
    if (!deleting) {
      ci++;
      if (ci > phrase.length) { deleting = true; wait = 1700; }
    } else {
      ci--;
      if (ci < 0) { deleting = false; ci = 0; pi = (pi + 1) % phrases.length; wait = 300; }
      else wait = 35;
    }
    window.setTimeout(typeLoop, wait);
  }
  typeLoop();

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const reveal = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.13 });
    reveal.forEach((el) => observer.observe(el));
  } else reveal.forEach((el) => el.classList.add("in"));
})();
