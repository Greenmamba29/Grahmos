let idx: any
export async function initIndex(){ idx = { docs: [], fields: ['id','title','url','summary'] } }
export async function addDocs(docs:{id:string,title:string,url:string,summary?:string}[]){ idx.docs.push(...docs) }
export async function search(q:string){ return idx.docs.filter((doc:any) => Object.values(doc).some((val:any) => String(val).toLowerCase().includes(q.toLowerCase()))) }
