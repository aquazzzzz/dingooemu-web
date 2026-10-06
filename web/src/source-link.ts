// The repository containing this release's modified sources and build scripts.
export function setupSourceLink(root:HTMLElement) {
  const source=(import.meta.env.VITE_SITE_SOURCE_URL??'https://github.com/aquazzzzz/dingooemu-web').trim();
  if(!source)return;
  let url:URL;
  try {url=new URL(source);}catch {return;}
  if(url.protocol!=='https:')return;
  for(const link of root.querySelectorAll<HTMLAnchorElement>('[data-site-source]')){
    link.href=url.href;link.hidden=false;
  }
}
