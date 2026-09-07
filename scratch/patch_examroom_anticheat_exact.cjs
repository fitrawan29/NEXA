const fs = require('fs');

let lines = fs.readFileSync('src/views/ExamRoom.jsx', 'utf8').split('\n');

let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   if (line.includes("const [blurOverlay, setBlurOverlay] = useState(false);")) {
       newLines.push(line);
       newLines.push("      const isSubmittingRef = useRef(false);");
       newLines.push("      const isBlockedRef = useRef(false);");
       continue;
   }

   if (line.includes("const executeSubmitExam = async (isAuto = false) => {")) {
       newLines.push(line);
       newLines.push("          setConfirmModal({ isOpen: false });");
       newLines.push("          if (isSubmittingRef.current) return;");
       newLines.push("  ");
       newLines.push("          isSubmittingRef.current = true;");
       newLines.push("          setIsSubmitting(true);");
       newLines.push("          setIsLoading(true);");
       skip = true;
       continue;
   }
   
   if (skip && line.includes("setIsLoading(true);")) {
       skip = false;
       continue;
   }

   if (line.includes("const handleBlurOverlay = () => {")) {
       newLines.push(line);
       newLines.push("         if (!isSubmittingRef.current && !isBlockedRef.current && navigator.onLine && jadwal.browser_lockdown) {");
       newLines.push("            setBlurOverlay(true);");
       newLines.push("            reportViolation();");
       newLines.push("         }");
       newLines.push("      };");
       skip = true;
       continue;
   }
   
   if (skip && line.includes("};")) {
       skip = false;
       continue;
   }
   
   if (line.includes("const setupAntiCheat = () => {")) {
       newLines.push("      const handleResize = () => {");
       newLines.push("        const activeElement = document.activeElement;");
       newLines.push("        const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');");
       newLines.push("        if (!isInput && window.innerHeight < window.screen.height * 0.70) {");
       newLines.push("             handleBlurOverlay();");
       newLines.push("        }");
       newLines.push("      };");
       newLines.push("");
       newLines.push(line);
       newLines.push("        if (jadwal.browser_lockdown) {");
       newLines.push("          document.addEventListener('visibilitychange', handleVisibilityChange);");
       newLines.push("          document.addEventListener('fullscreenchange', handleFullscreenChange);");
       newLines.push("          window.addEventListener('blur', handleWindowBlur);");
       newLines.push("          window.addEventListener('resize', handleResize);");
       newLines.push("        }");
       newLines.push("      };");
       skip = true;
       continue;
   }
   
   if (skip && line.includes("};")) {
       skip = false;
       continue;
   }

   if (line.includes("window.removeEventListener('blur', handleWindowBlur);")) {
       newLines.push(line);
       newLines.push("          window.removeEventListener('resize', handleResize);");
       continue;
   }

   if (!skip) {
       newLines.push(line);
   }
}

fs.writeFileSync('src/views/ExamRoom.jsx', newLines.join('\n'));
console.log("ExamRoom fixed exactly via line-by-line!");
