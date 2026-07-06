import { Fragment, type ReactNode } from "react";
import type { MintlifyIntegrations } from "../schema";

/**
 * Analytics/tracking scripts for `integrations` in docs.json.
 *
 * Only script-based integrations are supported, they are injected into `<head>`.
 */

function inline(code: string): ReactNode {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function renderIntegrations(integrations: MintlifyIntegrations): ReactNode {
  const nodes: ReactNode[] = [];

  if (integrations.ga4) {
    const id = integrations.ga4.measurementId;
    nodes.push(
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
      />,
      inline(
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(id)});`,
      ),
    );
  }

  if (integrations.gtm) {
    const id = integrations.gtm.tagId;
    nodes.push(
      inline(
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(id)});`,
      ),
    );
  }

  if (integrations.plausible) {
    const { domain, server = "plausible.io" } = integrations.plausible;
    nodes.push(
      <script
        defer
        data-domain={domain}
        src={`https://${server.replace(/^https?:\/\//, "")}/js/script.js`}
      />,
    );
  }

  if (integrations.fathom) {
    nodes.push(
      <script
        src="https://cdn.usefathom.com/script.js"
        data-site={integrations.fathom.siteId}
        defer
      />,
    );
  }

  if (integrations.pirsch) {
    nodes.push(
      <script
        defer
        src="https://api.pirsch.io/pa.js"
        id="pianjs"
        data-code={integrations.pirsch.id}
      />,
    );
  }

  if (integrations.posthog) {
    const { apiKey, apiHost = "https://us.i.posthog.com" } = integrations.posthog;
    nodes.push(
      inline(
        `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(apiKey)},{api_host:${JSON.stringify(apiHost)}});`,
      ),
    );
  }

  if (integrations.mixpanel) {
    const { projectToken, region } = integrations.mixpanel;
    const apiHost =
      region === "eu"
        ? "https://api-eu.mixpanel.com"
        : region === "in"
          ? "https://api-in.mixpanel.com"
          : undefined;
    nodes.push(
      <script async src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js" />,
      inline(
        `window.addEventListener('load',function(){if(window.mixpanel)mixpanel.init(${JSON.stringify(projectToken)}${apiHost ? `,{api_host:${JSON.stringify(apiHost)}}` : ""});});`,
      ),
    );
  }

  if (integrations.amplitude) {
    nodes.push(
      <script async src="https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz" />,
      inline(
        `window.addEventListener('load',function(){if(window.amplitude)amplitude.init(${JSON.stringify(integrations.amplitude.apiKey)});});`,
      ),
    );
  }

  if (integrations.clarity) {
    nodes.push(
      inline(
        `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(integrations.clarity.projectId)});`,
      ),
    );
  }

  if (integrations.heap) {
    nodes.push(
      inline(
        `window.heap=window.heap||[],heap.load=function(e,t){window.heap.appid=e,window.heap.config=t=t||{};var r=document.createElement("script");r.type="text/javascript",r.async=!0,r.src="https://cdn.heapanalytics.com/js/heap-"+e+".js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(r,a);for(var n=function(e){return function(){heap.push([e].concat(Array.prototype.slice.call(arguments,0)))}},p=["addEventProperties","addUserProperties","clearEventProperties","identify","resetIdentity","removeEventProperty","setEventProperties","track","unsetEventProperty"],o=0;o<p.length;o++)heap[p[o]]=n(p[o])};heap.load(${JSON.stringify(integrations.heap.appId)});`,
      ),
    );
  }

  if (integrations.hotjar) {
    const { hjid, hjsv } = integrations.hotjar;
    nodes.push(
      inline(
        `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${JSON.stringify(hjid)},hjsv:${JSON.stringify(hjsv)}};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
      ),
    );
  }

  if (integrations.intercom) {
    const appId = integrations.intercom.appId;
    nodes.push(
      inline(
        `window.intercomSettings={api_base:"https://api-iam.intercom.io",app_id:${JSON.stringify(appId)}};(function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/'+${JSON.stringify(appId)};var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};if(document.readyState==='complete'){l();}else if(w.attachEvent){w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();`,
      ),
    );
  }

  if (integrations.koala) {
    nodes.push(
      inline(
        `!function(t){if(window.ko)return;window.ko=[],["identify","track","removeListeners","on","off","qualify","ready"].forEach(function(t){ko[t]=function(){var n=[].slice.call(arguments);return n.unshift(t),ko.push(n),ko}});var n=document.createElement("script");n.async=!0,n.setAttribute("src","https://cdn.getkoala.com/v1/"+t+"/sdk.js"),(document.body||document.head).appendChild(n)}(${JSON.stringify(integrations.koala.publicApiKey)});`,
      ),
    );
  }

  if (integrations.logrocket) {
    nodes.push(
      <script async src="https://cdn.logrocket.io/LogRocket.min.js" crossOrigin="anonymous" />,
      inline(
        `window.addEventListener('load',function(){if(window.LogRocket)window.LogRocket.init(${JSON.stringify(integrations.logrocket.appId)});});`,
      ),
    );
  }

  if (integrations.segment) {
    const key = integrations.segment.key;
    nodes.push(
      inline(
        `!function(){var i="analytics",analytics=window[i]=window[i]||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","screen","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware","register"];analytics.factory=function(e){return function(){if(window[i].initialized)return window[i][e].apply(window[i],arguments);var n=Array.prototype.slice.call(arguments);if(["track","screen","alias","group","page","identify"].indexOf(e)>-1){var c=document.querySelector("link[rel='canonical']");n.push({__t:"bpc",c:c&&c.getAttribute("href")||void 0,p:location.pathname,u:location.href,s:location.search,t:document.title,r:document.referrer})}n.unshift(e);analytics.push(n);return analytics}};for(var n=0;n<analytics.methods.length;n++){var key=analytics.methods[n];analytics[key]=analytics.factory(key)}analytics.load=function(key,n){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.setAttribute("data-global-segment-analytics-key",i);t.src="https://cdn.segment.com/analytics.js/v1/"+key+"/analytics.min.js";var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r);analytics._loadOptions=n};analytics._writeKey=key="${key.replace(/[^\w-]/g, "")}";analytics.SNIPPET_VERSION="5.2.0";analytics.load(key);analytics.page()}}();`,
      ),
    );
  }

  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}
