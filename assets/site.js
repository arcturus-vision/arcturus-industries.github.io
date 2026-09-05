function createArcturusSound(context, destination, logoPoints) {
  const c=context, bus=c.createGain(), output=c.createGain();
  const lowpass=c.createBiquadFilter(), limiter=c.createDynamicsCompressor();
  lowpass.type='lowpass';lowpass.frequency.value=7200;lowpass.Q.value=.5;
  limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=5;
  limiter.attack.value=.003;limiter.release.value=.2;
  output.gain.value=0;
  bus.connect(lowpass).connect(limiter).connect(output).connect(destination);

  // A freshly synthesized stereo diffusion tail, never a downloaded sample.
  const space=c.createConvolver(), wet=c.createGain();
  const impulse=c.createBuffer(2,Math.ceil(c.sampleRate*.9),c.sampleRate);
  for(let ch=0;ch<2;ch++) {
    const samples=impulse.getChannelData(ch);
    for(let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*Math.exp(-7*i/samples.length)*.35;
  }
  space.buffer=impulse;wet.gain.value=.21;
  bus.connect(space).connect(wet).connect(lowpass);

  const noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);
  const noiseData=noiseBuffer.getChannelData(0);
  for(let i=0;i<noiseData.length;i++)noiseData[i]=Math.random()*2-1;
  const noise=c.createBufferSource(), filter=c.createBiquadFilter(), air=c.createGain();
  const orbit=c.createStereoPanner();
  noise.buffer=noiseBuffer;noise.loop=true;filter.type='bandpass';filter.Q.value=1.8;
  air.gain.value=0;noise.connect(filter).connect(air).connect(orbit).connect(bus);noise.start();

  const core=c.createOscillator(), coreGain=c.createGain();
  const shimmer=c.createOscillator(), shimmerGain=c.createGain();
  const modulator=c.createOscillator(), modulation=c.createGain();
  core.type='sine';core.frequency.value=55;coreGain.gain.value=0;
  core.connect(coreGain).connect(bus);core.start();
  shimmer.type='sine';shimmer.frequency.value=220;shimmerGain.gain.value=0;
  modulator.frequency.value=137;modulation.gain.value=0;
  modulator.connect(modulation).connect(shimmer.frequency);
  shimmer.connect(shimmerGain).connect(bus);shimmer.start();modulator.start();

  let nextGrain=0,serial=0;
  const voices=new Set();
  const chase=(param,value,time,speed=.035)=>param.setTargetAtTime(value,time,speed);
  function grain(time,frequency,pan,amplitude,length,bend,metal=0) {
    const carrier=c.createOscillator(), envelope=c.createGain(), stereo=c.createStereoPanner();
    carrier.type='sine';carrier.frequency.setValueAtTime(frequency,time);
    carrier.frequency.exponentialRampToValueAtTime(Math.max(40,frequency*bend),time+length);
    envelope.gain.setValueAtTime(.00001,time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.00002,amplitude),time+.006);
    envelope.gain.exponentialRampToValueAtTime(.00001,time+length);
    stereo.pan.setValueAtTime(Math.max(-1,Math.min(1,pan)),time);
    carrier.connect(envelope).connect(stereo).connect(bus);
    let fm,fmGain;
    if(metal>0) {
      fm=c.createOscillator();fmGain=c.createGain();fm.frequency.value=frequency*1.4142;
      fmGain.gain.setValueAtTime(frequency*metal,time);
      fmGain.gain.exponentialRampToValueAtTime(.01,time+length);
      fm.connect(fmGain).connect(carrier.frequency);fm.start(time);fm.stop(time+length+.01);
    }
    voices.add(carrier);carrier.start(time);carrier.stop(time+length+.015);
    carrier.onended=()=>{carrier.disconnect();envelope.disconnect();stereo.disconnect();if(fm){fm.disconnect();fmGain.disconnect();}voices.delete(carrier);};
  }
  function update(progress,returnPhase,returning,pan=0,time=c.currentTime) {
    const p=Math.max(0,Math.min(1,progress));
    const energy=Math.max(0,Math.sin(Math.PI*(returning?returnPhase:p)));
    const activity=Math.pow(energy,.7);
    chase(core.frequency,returning?55+145*(1-returnPhase):55+55*p,time);
    chase(coreGain.gain,activity*.085,time);
    chase(filter.frequency,returning?500+5200*(1-returnPhase):650+3700*energy+1100*p,time);
    chase(air.gain,activity*(returning?.11:.045),time);
    chase(shimmer.frequency,returning?180+550*(1-returnPhase):146.83+146.83*p,time);
    chase(shimmerGain.gain,activity*.038,time);
    chase(modulator.frequency,returning?430:97.999+98*p,time);
    chase(modulation.gain,activity*(returning?260:95),time);
    chase(orbit.pan,returning?Math.sin(returnPhase*Math.PI*4)*.85:Math.sin(p*Math.PI*3)*.5+pan*.2,time);
    if(activity<.02){nextGrain=time;return;}
    nextGrain=Math.max(nextGrain,time);
    const rate=(returning?115:32)+activity*(returning?140:135);
    // Audio-clock lookahead. Grain density, pitch, and position follow the cloud.
    while(nextGrain<time+.025) {
      const point=logoPoints[(serial++*137)%logoPoints.length];
      const y=point[1]*(1-p)+point[3]*p;
      const x=point[0]*(1-p)+point[2]*p;
      const steps=[0,7,12,14,19,24,26,31];
      const note=steps[Math.min(7,Math.floor((y+.55)*7))]||0;
      const coherent=293.665*Math.pow(2,note/12);
      const jitter=1+(Math.random()-.5)*energy*.45;
      const pitch=returning?coherent*(1.5-returnPhase*.8):coherent*jitter;
      grain(nextGrain,pitch,Math.sin(serial*2.399+x*2+(returning?returnPhase*9:0))*.92,
        (.011+Math.random()*.014)*activity,.024+Math.random()*.055,
        returning?.35:1.04+energy*.6,energy*.35);
      nextGrain+=1/rate;
    }
  }
  function quiet(time=c.currentTime) {
    for(const gain of [coreGain,shimmerGain,air])chase(gain.gain,0,time,.045);
    nextGrain=time;
  }
  function resolve(time=c.currentTime) {
    quiet(time);
    [293.665,440,587.33,880].forEach((frequency,i)=>grain(time+i*.026,frequency,(i-1.5)*.3,.024,1.1-i*.1,1,.07));
  }
  return {
    update,quiet,resolve,
    setEnabled(enabled,time=c.currentTime){chase(output.gain,enabled?.58:0,time,.025);},
    reset(time=c.currentTime){nextGrain=time;},
    dispose(){[noise,core,shimmer,modulator].forEach(source=>{source.stop();source.disconnect();});for(const voice of voices){try{voice.stop();}catch{}}output.disconnect();}
  };
}

  (() => {
    const root = document.getElementById('arcturus-transition');
    const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
    if(!ctx)return;
    root.querySelector('.av-stage').disabled=false;
    root.querySelector('.av-sound').hidden=false;
    const points = arcturusLogoPoints;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settings = { progress: 0, depth: 1, duration: 4.2, headline: 'chapter' };
    let width=1,height=1,frame=0,start=0,active=false,tiltX=0,tiltY=0;
    let motion='forward',returnFrom=1,returnPhase=0;
    const smooth=t=>t*t*(3-2*t);
    const mix=(a,b,t)=>a+(b-a)*t;
    const soundButton=root.querySelector('.av-sound');
    let soundContext,soundGraph,soundOn=false,soundMutedByUser=false,sleepTimer;
    function updateSoundButton() {
      soundButton.setAttribute('aria-pressed',String(soundOn));
      soundButton.setAttribute('aria-label',soundOn?'Mute procedural sound':'Enable procedural sound');
      soundButton.title=soundButton.getAttribute('aria-label');
    }
    async function enableSound() {
      clearTimeout(sleepTimer);
      try {
        if(!soundContext||soundContext.state==='closed') {
          const AudioEngine=window.AudioContext||window.webkitAudioContext;
          if(!AudioEngine)throw new Error('Web Audio unavailable');
          soundContext=new AudioEngine();
          soundGraph=createArcturusSound(soundContext,soundContext.destination,points);
        }
        await soundContext.resume();
        if(soundMutedByUser||document.hidden)return;
        soundOn=true;soundGraph.setEnabled(true);soundGraph.reset();updateSoundButton();
        if(!active)sleepTimer=setTimeout(()=>soundContext.suspend().catch(()=>{}),150);
      } catch(error) {
        soundOn=false;updateSoundButton();soundButton.disabled=true;soundButton.title='Sound unavailable in this browser';
        soundButton.setAttribute('aria-pressed','false');soundButton.setAttribute('aria-label','Sound unavailable in this browser');
      }
    }
    function syncSound() {
      if(soundOn&&soundContext?.state==='running')soundGraph.update(smooth(settings.progress),returnPhase,motion==='return',tiltX);
    }
    function settleSound() {
      if(!soundOn||soundContext?.state!=='running')return;
      soundGraph.resolve();clearTimeout(sleepTimer);
      sleepTimer=setTimeout(()=>{if(!active)soundContext.suspend().catch(()=>{});},1600);
    }
    soundButton.addEventListener('click',()=>{
      if(soundOn) {
        soundMutedByUser=true;soundOn=false;soundGraph.setEnabled(false);soundGraph.quiet();updateSoundButton();
        clearTimeout(sleepTimer);sleepTimer=setTimeout(()=>soundContext.suspend().catch(()=>{}),120);
      } else {
        soundMutedByUser=false;enableSound();swirlBack();
      }
    });
    function draw() {
      ctx.clearRect(0,0,width,height);
      const t=smooth(settings.progress), arc=Math.sin(Math.PI*t), scale=Math.min(width*.7,height*.82);
      const yaw=arc*.78+tiltX, pitch=tiltY;
      const vortex=Math.sin(Math.PI*returnPhase), spin=smooth(returnPhase)*Math.PI*2;
      const cloud=[];
      points.forEach((p,i)=>{
        const phase=i*2.399963;
        let x=mix(p[0],p[2],t)+arc*Math.cos(phase)*.09*settings.depth;
        let y=mix(p[1],p[3],t)+arc*Math.sin(phase)*.065*settings.depth;
        let z=arc*Math.sin(phase*.71)*.52*settings.depth;
        const angle=spin+vortex*Math.sin(phase*.31)*.45;
        const swirlX=x*Math.cos(angle)-y*Math.sin(angle);
        y=(x*Math.sin(angle)+y*Math.cos(angle))*(1+vortex*.3);
        x=swirlX*(1+vortex*.3);
        z+=vortex*Math.cos(phase*.53)*.32*settings.depth;
        const rx=x*Math.cos(yaw)+z*Math.sin(yaw), rz=z*Math.cos(yaw)-x*Math.sin(yaw);
        const ry=y*Math.cos(pitch)-rz*Math.sin(pitch), depth=rz*Math.cos(pitch)+y*Math.sin(pitch);
        const perspective=2.1/(2.1-depth);
        const color=p.slice(4,7).map(v=>Math.round(mix(231,v,t)));
        cloud.push({x:width/2+rx*scale*perspective,y:height/2+ry*scale*perspective,z:depth,r:(.62+((i*17)%11)/17)*perspective*(scale/250),color});
      });
      cloud.sort((a,b)=>a.z-b.z);
      cloud.forEach(p=>{
        ctx.fillStyle=`rgba(${p.color.join(',')},${.65+(p.z+.6)*.22})`;
        ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.4,p.r),0,Math.PI*2);ctx.fill();
      });
      root.classList.add('has-canvas');
    }
    function resize() {
      const bounds=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
      width=bounds.width;height=bounds.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();
    }
    function animate(now) {
      if(!active)return;
      if(motion==='return') {
        returnPhase=Math.min(1,(now-start)/800);
        settings.progress=mix(returnFrom,0,smooth(returnPhase));
        syncSound();
        draw();
        if(returnPhase===1){motion='forward';returnPhase=0;start=now;}
        frame=requestAnimationFrame(animate);
        return;
      }
      settings.progress=Math.min(1,Math.max(0,(now-start-900)/(settings.duration*1000)));
      syncSound();
      draw();
      if(settings.progress<1)frame=requestAnimationFrame(animate);else {active=false;settleSound();}
    }
    function play() {
      cancelAnimationFrame(frame);
      motion='forward';returnPhase=0;
      if(reduced.matches){settings.progress=1;active=false;draw();return;}
      settings.progress=0;start=performance.now();active=true;frame=requestAnimationFrame(animate);
    }
    function swirlBack() {
      if(motion==='return'&&active)return;
      cancelAnimationFrame(frame);
      if(reduced.matches){settings.progress=settings.progress>.5?0:1;active=false;returnPhase=0;draw();return;}
      returnFrom=settings.progress;returnPhase=0;motion='return';start=performance.now();active=true;frame=requestAnimationFrame(animate);
    }
    root.querySelector('.av-stage').addEventListener('click',()=>{
      if(!soundMutedByUser)enableSound();
      swirlBack();
    });
    canvas.addEventListener('pointermove',e=>{if(reduced.matches)return;const r=canvas.getBoundingClientRect();tiltX=((e.clientX-r.left)/r.width-.5)*.3;tiltY=((e.clientY-r.top)/r.height-.5)*.2;draw();});
    canvas.addEventListener('pointerleave',()=>{tiltX=0;tiltY=0;draw();});
    const observer=new ResizeObserver(resize);observer.observe(canvas);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);active=false;returnPhase=0;settings.progress=1;soundGraph?.quiet();soundContext?.suspend().catch(()=>{});}draw();});
    window.addEventListener('pagehide',()=>{clearTimeout(sleepTimer);soundContext?.close().catch(()=>{});});
    reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimationFrame(frame);active=false;returnPhase=0;settings.progress=1;soundGraph?.quiet();draw();}});
    resize();play();
  })();
