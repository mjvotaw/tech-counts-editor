if(!self.define){let s,e={};const n=(n,i)=>(n=new URL(n+".js",i).href,e[n]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=n,s.onload=e,document.head.appendChild(s)}else s=n,importScripts(n),e()})).then((()=>{let s=e[n];if(!s)throw new Error(`Module ${n} didn’t register its module`);return s})));self.define=(i,l)=>{const r=s||("document"in self?document.currentScript.src:"")||location.href;if(e[r])return;let a={};const o=s=>n(s,r),t={module:{uri:r},exports:a,require:o};e[r]=Promise.all(i.map((s=>t[s]||o(s)))).then((s=>(l(...s),a)))}}define(["./workbox-6db16f92"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"App-ea9e8cb1.js",revision:null},{url:"app/index.html",revision:"97ef30fb9fc5fb8c31984cf23b4c8b56"},{url:"assets/App-559ae3c3.css",revision:null},{url:"assets/ChartManager-00dfcf8b.css",revision:null},{url:"assets/index-8c6c3f75.css",revision:null},{url:"assets/SafariFileWorker-557e53c3.js",revision:null},{url:"ChartManager-350c90eb.js",revision:null},{url:"downloader-23264d59.js",revision:null},{url:"embed.js",revision:"0f1a49736cf2e030cf9cf480bfba49b5"},{url:"embed/index.html",revision:"0b989b24827a5dded573331ea0e0ae0c"},{url:"FileSystemWritableFileStream-e4c13ad9.js",revision:null},{url:"index.html",revision:"1a4da5ae33d278b03ef2b59f0e8d063f"},{url:"memory-ac1a320a.js",revision:null},{url:"NodeFileHandler-0143b164.js",revision:null},{url:"OggDec-2941c3fd.js",revision:null},{url:"registerSW.js",revision:"fd92b81feca2a11106e806ac04c595a9"},{url:"web-streams-ponyfill-4a0f4950.js",revision:null},{url:"assets/app/versions.json",revision:"4ba536c7c2aa91a3e28b6af8a0f19d9d"},{url:"assets/assist_tick-b8aada2a.ogg",revision:null},{url:"assets/body-614d0188.png",revision:null},{url:"assets/decent-f3f8a110.png",revision:null},{url:"assets/excellent-84718ac0.png",revision:null},{url:"assets/fantastic-1755e773.png",revision:null},{url:"assets/font/Assistant-Hebrew.woff2",revision:"e99c63e8dcd7799e8adf32df82b46376"},{url:"assets/font/Assistant-Latin.woff2",revision:"a416191c7641acf049f804b685235d3d"},{url:"assets/font/Assistant-LatinExt.woff2",revision:"2423d82cdbc6a34b99d5bbacf82623c7"},{url:"assets/frame-d599a2fe.png",revision:null},{url:"assets/great-0e864574.png",revision:null},{url:"assets/highpass-d9d7cfcb.svg",revision:null},{url:"assets/highshelf-11ccf64e.svg",revision:null},{url:"assets/hold_judgment-82934f15.png",revision:null},{url:"assets/hold-7b947e11.png",revision:null},{url:"assets/icon/favicon.ico",revision:"7bcbdd2344641a21b0f6f9393b491d65"},{url:"assets/icon/icon_512.png",revision:"1a4014fcbfaa08050ff38cabb8235165"},{url:"assets/icon/logo.png",revision:"3170c21a8539047fffea9eb4bd912d8e"},{url:"assets/icon/mac.icns",revision:"ac52a49fb658a942abeaa019bd05e9aa"},{url:"assets/judgmentITG-5390eacd.png",revision:null},{url:"assets/judgmentWaterfall-5bb3f994.png",revision:null},{url:"assets/LeftFoot-cb1648da.png",revision:null},{url:"assets/lowpass-ff013247.svg",revision:null},{url:"assets/lowshelf-2b031328.svg",revision:null},{url:"assets/metronome_high-6fa54e52.ogg",revision:null},{url:"assets/metronome_low-4db4e760.ogg",revision:null},{url:"assets/mine-590d445e.png",revision:null},{url:"assets/mine-b65ce42d.ogg",revision:null},{url:"assets/parts-0c8fa692.png",revision:null},{url:"assets/parts-9668caec.png",revision:null},{url:"assets/parts-b37af2cf.png",revision:null},{url:"assets/peaking-eec48769.svg",revision:null},{url:"assets/way_off-8bc3fd65.png",revision:null},{url:"assets/white_fantastic-b65b4f11.png",revision:null},{url:"assets/icon/icon_512.png",revision:"1a4014fcbfaa08050ff38cabb8235165"},{url:"manifest.json",revision:"b44ceb6ce547805818928d85a1557349"}],{ignoreURLParametersMatching:[/^flags/,/^url/,/^chartIndex/,/^chartType/]}),s.cleanupOutdatedCaches()}));
