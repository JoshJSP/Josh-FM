(()=>{
  const $=id=>document.getElementById(id);
  function guard(){
    const q=$('queueInfo'),setup=$('setup'),connect=$('connect');
    const text=(q?.textContent||'').toLowerCase();
    if(text.includes('opnieuw gekoppeld')||text.includes('niet gekoppeld')||text.includes('spotify-login')){
      setup?.classList.remove('hidden');if(connect)connect.disabled=false;
    }
  }
  setInterval(guard,500);window.addEventListener('pageshow',guard);setTimeout(guard,700);
})();