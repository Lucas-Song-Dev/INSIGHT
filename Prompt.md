api.js:326  GET http://localhost:5000/api/status 401 (UNAUTHORIZED)
dispatchXhrRequest @ axios.js?v=0b6e57dd:1637
xhr @ axios.js?v=0b6e57dd:1517
dispatchRequest @ axios.js?v=0b6e57dd:1992
_request @ axios.js?v=0b6e57dd:2213
request @ axios.js?v=0b6e57dd:2104
Axios.<computed> @ axios.js?v=0b6e57dd:2232
wrap @ axios.js?v=0b6e57dd:8
fetchStatus @ api.js:326
checkAuth @ AuthContext.jsx:20
await in checkAuth
(anonymous) @ AuthContext.jsx:45
commitHookEffectListMount @ chunk-KDCVS43I.js?v=0b6e57dd:16963
commitPassiveMountOnFiber @ chunk-KDCVS43I.js?v=0b6e57dd:18206
commitPassiveMountEffects_complete @ chunk-KDCVS43I.js?v=0b6e57dd:18179
commitPassiveMountEffects_begin @ chunk-KDCVS43I.js?v=0b6e57dd:18169
commitPassiveMountEffects @ chunk-KDCVS43I.js?v=0b6e57dd:18159
flushPassiveEffectsImpl @ chunk-KDCVS43I.js?v=0b6e57dd:19543
flushPassiveEffects @ chunk-KDCVS43I.js?v=0b6e57dd:19500
(anonymous) @ chunk-KDCVS43I.js?v=0b6e57dd:19381
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
contentScript.bundle.js:1  GET chrome-extension://pbanhockgagggenencehbnadejlgchfc/assets/userReportLinkedCandidate.json net::ERR_FILE_NOT_FOUND
(anonymous) @ contentScript.bundle.js:1
(anonymous) @ contentScript.bundle.js:1
nl @ contentScript.bundle.js:1
wc @ contentScript.bundle.js:1
(anonymous) @ contentScript.bundle.js:1
j @ contentScript.bundle.js:1
P @ contentScript.bundle.js:1Understand this error
api.js:326  GET http://localhost:5000/api/status 401 (UNAUTHORIZED)
dispatchXhrRequest @ axios.js?v=0b6e57dd:1637
xhr @ axios.js?v=0b6e57dd:1517
dispatchRequest @ axios.js?v=0b6e57dd:1992
_request @ axios.js?v=0b6e57dd:2213
request @ axios.js?v=0b6e57dd:2104
Axios.<computed> @ axios.js?v=0b6e57dd:2232
wrap @ axios.js?v=0b6e57dd:8
fetchStatus @ api.js:326
checkAuth @ AuthContext.jsx:20
await in checkAuth
(anonymous) @ AuthContext.jsx:45
commitHookEffectListMount @ chunk-KDCVS43I.js?v=0b6e57dd:16963
invokePassiveEffectMountInDEV @ chunk-KDCVS43I.js?v=0b6e57dd:18374
invokeEffectsInDev @ chunk-KDCVS43I.js?v=0b6e57dd:19754
commitDoubleInvokeEffectsInDEV @ chunk-KDCVS43I.js?v=0b6e57dd:19739
flushPassiveEffectsImpl @ chunk-KDCVS43I.js?v=0b6e57dd:19556
flushPassiveEffects @ chunk-KDCVS43I.js?v=0b6e57dd:19500
(anonymous) @ chunk-KDCVS43I.js?v=0b6e57dd:19381
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
App.jsx:181 Warning: React has detected a change in the order of Hooks called by App. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks

   Previous render            Next render
   ------------------------------------------------------
1. useState                   useState
2. useState                   useState
3. useContext                 useContext
4. useEffect                  useEffect
5. undefined                  useState
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 Error Component Stack
    at App (App.jsx:34:39)
    at NotificationProvider (NotificationContext.jsx:6:40)
    at AuthProvider (AuthContext.jsx:7:32)
overrideMethod @ hook.js:608
printWarning @ chunk-KDCVS43I.js?v=0b6e57dd:521
error @ chunk-KDCVS43I.js?v=0b6e57dd:505
warnOnHookMismatchInDev @ chunk-KDCVS43I.js?v=0b6e57dd:11543
updateHookTypesDev @ chunk-KDCVS43I.js?v=0b6e57dd:11513
useState @ chunk-KDCVS43I.js?v=0b6e57dd:12797
useState @ chunk-RLJ2RCJQ.js?v=0b6e57dd:1066
App @ App.jsx:181
renderWithHooks @ chunk-KDCVS43I.js?v=0b6e57dd:11596
updateFunctionComponent @ chunk-KDCVS43I.js?v=0b6e57dd:14630
beginWork @ chunk-KDCVS43I.js?v=0b6e57dd:15972
beginWork$1 @ chunk-KDCVS43I.js?v=0b6e57dd:19806
performUnitOfWork @ chunk-KDCVS43I.js?v=0b6e57dd:19251
workLoopSync @ chunk-KDCVS43I.js?v=0b6e57dd:19190
renderRootSync @ chunk-KDCVS43I.js?v=0b6e57dd:19169
performConcurrentWorkOnRoot @ chunk-KDCVS43I.js?v=0b6e57dd:18728
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
chunk-KDCVS43I.js?v=0b6e57dd:11726 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (chunk-KDCVS43I.js?v=0b6e57dd:11726:21)
    at updateReducer (chunk-KDCVS43I.js?v=0b6e57dd:11775:22)
    at updateState (chunk-KDCVS43I.js?v=0b6e57dd:12069:18)
    at Object.useState (chunk-KDCVS43I.js?v=0b6e57dd:12801:24)
    at useState (chunk-RLJ2RCJQ.js?v=0b6e57dd:1066:29)
    at App (App.jsx:181:51)
    at renderWithHooks (chunk-KDCVS43I.js?v=0b6e57dd:11596:26)
    at updateFunctionComponent (chunk-KDCVS43I.js?v=0b6e57dd:14630:28)
    at beginWork (chunk-KDCVS43I.js?v=0b6e57dd:15972:22)
    at HTMLUnknownElement.callCallback2 (chunk-KDCVS43I.js?v=0b6e57dd:3680:22)
updateWorkInProgressHook @ chunk-KDCVS43I.js?v=0b6e57dd:11726
updateReducer @ chunk-KDCVS43I.js?v=0b6e57dd:11775
updateState @ chunk-KDCVS43I.js?v=0b6e57dd:12069
useState @ chunk-KDCVS43I.js?v=0b6e57dd:12801
useState @ chunk-RLJ2RCJQ.js?v=0b6e57dd:1066
App @ App.jsx:181
renderWithHooks @ chunk-KDCVS43I.js?v=0b6e57dd:11596
updateFunctionComponent @ chunk-KDCVS43I.js?v=0b6e57dd:14630
beginWork @ chunk-KDCVS43I.js?v=0b6e57dd:15972
callCallback2 @ chunk-KDCVS43I.js?v=0b6e57dd:3680
invokeGuardedCallbackDev @ chunk-KDCVS43I.js?v=0b6e57dd:3705
invokeGuardedCallback @ chunk-KDCVS43I.js?v=0b6e57dd:3739
beginWork$1 @ chunk-KDCVS43I.js?v=0b6e57dd:19818
performUnitOfWork @ chunk-KDCVS43I.js?v=0b6e57dd:19251
workLoopSync @ chunk-KDCVS43I.js?v=0b6e57dd:19190
renderRootSync @ chunk-KDCVS43I.js?v=0b6e57dd:19169
performConcurrentWorkOnRoot @ chunk-KDCVS43I.js?v=0b6e57dd:18728
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
chunk-KDCVS43I.js?v=0b6e57dd:11726 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (chunk-KDCVS43I.js?v=0b6e57dd:11726:21)
    at updateReducer (chunk-KDCVS43I.js?v=0b6e57dd:11775:22)
    at updateState (chunk-KDCVS43I.js?v=0b6e57dd:12069:18)
    at Object.useState (chunk-KDCVS43I.js?v=0b6e57dd:12801:24)
    at useState (chunk-RLJ2RCJQ.js?v=0b6e57dd:1066:29)
    at App (App.jsx:181:51)
    at renderWithHooks (chunk-KDCVS43I.js?v=0b6e57dd:11596:26)
    at updateFunctionComponent (chunk-KDCVS43I.js?v=0b6e57dd:14630:28)
    at beginWork (chunk-KDCVS43I.js?v=0b6e57dd:15972:22)
    at HTMLUnknownElement.callCallback2 (chunk-KDCVS43I.js?v=0b6e57dd:3680:22)
updateWorkInProgressHook @ chunk-KDCVS43I.js?v=0b6e57dd:11726
updateReducer @ chunk-KDCVS43I.js?v=0b6e57dd:11775
updateState @ chunk-KDCVS43I.js?v=0b6e57dd:12069
useState @ chunk-KDCVS43I.js?v=0b6e57dd:12801
useState @ chunk-RLJ2RCJQ.js?v=0b6e57dd:1066
App @ App.jsx:181
renderWithHooks @ chunk-KDCVS43I.js?v=0b6e57dd:11596
updateFunctionComponent @ chunk-KDCVS43I.js?v=0b6e57dd:14630
beginWork @ chunk-KDCVS43I.js?v=0b6e57dd:15972
callCallback2 @ chunk-KDCVS43I.js?v=0b6e57dd:3680
invokeGuardedCallbackDev @ chunk-KDCVS43I.js?v=0b6e57dd:3705
invokeGuardedCallback @ chunk-KDCVS43I.js?v=0b6e57dd:3739
beginWork$1 @ chunk-KDCVS43I.js?v=0b6e57dd:19818
performUnitOfWork @ chunk-KDCVS43I.js?v=0b6e57dd:19251
workLoopSync @ chunk-KDCVS43I.js?v=0b6e57dd:19190
renderRootSync @ chunk-KDCVS43I.js?v=0b6e57dd:19169
recoverFromConcurrentError @ chunk-KDCVS43I.js?v=0b6e57dd:18786
performConcurrentWorkOnRoot @ chunk-KDCVS43I.js?v=0b6e57dd:18734
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
hook.js:608 The above error occurred in the <App> component:

    at App (http://localhost:5173/src/App.jsx?t=1765778508189:48:39)
    at NotificationProvider (http://localhost:5173/src/context/NotificationContext.jsx:20:40)
    at AuthProvider (http://localhost:5173/src/context/AuthContext.jsx:21:32)

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
overrideMethod @ hook.js:608
logCapturedError @ chunk-KDCVS43I.js?v=0b6e57dd:14080
update.callback @ chunk-KDCVS43I.js?v=0b6e57dd:14100
callCallback @ chunk-KDCVS43I.js?v=0b6e57dd:11296
commitUpdateQueue @ chunk-KDCVS43I.js?v=0b6e57dd:11313
commitLayoutEffectOnFiber @ chunk-KDCVS43I.js?v=0b6e57dd:17141
commitLayoutMountEffects_complete @ chunk-KDCVS43I.js?v=0b6e57dd:18030
commitLayoutEffects_begin @ chunk-KDCVS43I.js?v=0b6e57dd:18019
commitLayoutEffects @ chunk-KDCVS43I.js?v=0b6e57dd:17970
commitRootImpl @ chunk-KDCVS43I.js?v=0b6e57dd:19406
commitRoot @ chunk-KDCVS43I.js?v=0b6e57dd:19330
finishConcurrentRender @ chunk-KDCVS43I.js?v=0b6e57dd:18813
performConcurrentWorkOnRoot @ chunk-KDCVS43I.js?v=0b6e57dd:18768
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
chunk-KDCVS43I.js?v=0b6e57dd:11726 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (chunk-KDCVS43I.js?v=0b6e57dd:11726:21)
    at updateReducer (chunk-KDCVS43I.js?v=0b6e57dd:11775:22)
    at updateState (chunk-KDCVS43I.js?v=0b6e57dd:12069:18)
    at Object.useState (chunk-KDCVS43I.js?v=0b6e57dd:12801:24)
    at useState (chunk-RLJ2RCJQ.js?v=0b6e57dd:1066:29)
    at App (App.jsx:181:51)
    at renderWithHooks (chunk-KDCVS43I.js?v=0b6e57dd:11596:26)
    at updateFunctionComponent (chunk-KDCVS43I.js?v=0b6e57dd:14630:28)
    at beginWork (chunk-KDCVS43I.js?v=0b6e57dd:15972:22)
    at beginWork$1 (chunk-KDCVS43I.js?v=0b6e57dd:19806:22)
updateWorkInProgressHook @ chunk-KDCVS43I.js?v=0b6e57dd:11726
updateReducer @ chunk-KDCVS43I.js?v=0b6e57dd:11775
updateState @ chunk-KDCVS43I.js?v=0b6e57dd:12069
useState @ chunk-KDCVS43I.js?v=0b6e57dd:12801
useState @ chunk-RLJ2RCJQ.js?v=0b6e57dd:1066
App @ App.jsx:181
renderWithHooks @ chunk-KDCVS43I.js?v=0b6e57dd:11596
updateFunctionComponent @ chunk-KDCVS43I.js?v=0b6e57dd:14630
beginWork @ chunk-KDCVS43I.js?v=0b6e57dd:15972
beginWork$1 @ chunk-KDCVS43I.js?v=0b6e57dd:19806
performUnitOfWork @ chunk-KDCVS43I.js?v=0b6e57dd:19251
workLoopSync @ chunk-KDCVS43I.js?v=0b6e57dd:19190
renderRootSync @ chunk-KDCVS43I.js?v=0b6e57dd:19169
recoverFromConcurrentError @ chunk-KDCVS43I.js?v=0b6e57dd:18786
performConcurrentWorkOnRoot @ chunk-KDCVS43I.js?v=0b6e57dd:18734
workLoop @ chunk-KDCVS43I.js?v=0b6e57dd:197
flushWork @ chunk-KDCVS43I.js?v=0b6e57dd:176
performWorkUntilDeadline @ chunk-KDCVS43I.js?v=0b6e57dd:384Understand this error
api.js:351  GET http://localhost:5000/api/user/profile 401 (UNAUTHORIZED)
dispatchXhrRequest @ axios.js?v=0b6e57dd:1637
xhr @ axios.js?v=0b6e57dd:1517
dispatchRequest @ axios.js?v=0b6e57dd:1992
_request @ axios.js?v=0b6e57dd:2213
request @ axios.js?v=0b6e57dd:2104
Axios.<computed> @ axios.js?v=0b6e57dd:2232
wrap @ axios.js?v=0b6e57dd:8
fetchUserProfile @ api.js:351
login @ AuthContext.jsx:53
await in login
handleSubmit @ LoginPage.jsx:24
await in handleSubmit
callCallback2 @ chunk-KDCVS43I.js?v=0b6e57dd:3680
invokeGuardedCallbackDev @ chunk-KDCVS43I.js?v=0b6e57dd:3705
invokeGuardedCallback @ chunk-KDCVS43I.js?v=0b6e57dd:3739
invokeGuardedCallbackAndCatchFirstError @ chunk-KDCVS43I.js?v=0b6e57dd:3742
executeDispatch @ chunk-KDCVS43I.js?v=0b6e57dd:7046
processDispatchQueueItemsInOrder @ chunk-KDCVS43I.js?v=0b6e57dd:7066
processDispatchQueue @ chunk-KDCVS43I.js?v=0b6e57dd:7075
dispatchEventsForPlugins @ chunk-KDCVS43I.js?v=0b6e57dd:7083
(anonymous) @ chunk-KDCVS43I.js?v=0b6e57dd:7206
batchedUpdates$1 @ chunk-KDCVS43I.js?v=0b6e57dd:18966
batchedUpdates @ chunk-KDCVS43I.js?v=0b6e57dd:3585
dispatchEventForPluginEventSystem @ chunk-KDCVS43I.js?v=0b6e57dd:7205
dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay @ chunk-KDCVS43I.js?v=0b6e57dd:5484
dispatchEvent @ chunk-KDCVS43I.js?v=0b6e57dd:5478
dispatchDiscreteEvent @ chunk-KDCVS43I.js?v=0b6e57dd:5455Understand this error
AuthContext.jsx:58 Failed to fetch user profile: Error: Authentication token is missing
    at fetchUserProfile (api.js:360:13)
    at async login (AuthContext.jsx:53:31)