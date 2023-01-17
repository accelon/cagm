import { notEqual } from 'assert';
import { existsSync } from 'fs';
import Path from 'path'
import {glob,nodefs,writeChanged,parseXMLAttribute,parseXML,readTextContent, readTextLines } from 'ptk/nodebundle.cjs'; //ptk/pali
await nodefs; //export fs to global
const files=readTextLines('full.lst');
const rootdir='T/';
const ctx={ele:{},nested:[],fn:''}

//將note 可能包含的 tag 換成等效的null tag,
//以抽出notetext
const escapeQuote=t=>{
    return t.replace(/"/g,'＂');
}
const nullify_note=content=>{
    //夾注    
    content=content.replace(/<note([^>]*?)>([^<]+)<\/note>/g,(m,_attrs,t)=>{
        const {place,type,n,resp}=parseXMLAttribute(_attrs);
        let note='';
        if (place=='inline') note= '〔'+t+'〕';
        else if (place=='foot text' && type=='orig') {
            note='<origfoot n="'+n+'" t="'+escapeQuote(t)+'"/>'
        } else if (type) {
            if (type.startsWith('cf')) {
                note='['+type+'_'+t+']';
            } else {
                note='<'+type+'_note'+
                (n?' n="'+n+'"':'')+
                (resp?' resp="'+resp +'"':'')
                +' t="'+escapeQuote(t)+'"/>'
            }
        }
        return note;
    })

    // // 高麗藏,
    // content=content.replace(/<note type="cf(\d+)">([^<]+)<\/note>/g,'[cf$1_$2]')

    // //大正藏原始腳注
    // content=content.replace(/<note n="([a-z\d]+)" resp="([^<]+)" type="orig" place="foot text">([^<]+)<\/note>/g,(m,n,resp,t)=>{
    //     return '<origfoot n="'+n+'" t="'+escapeQuote(t)+'"/>'
    // });
    // //有時先出現 foot text
    // content=content.replace(/<note place="foot text" type="orig" n="([a-z\d]+)" resp="([^<]+)">([^<]+)<\/note>/g,(m,n,resp,t)=>{
    //     return '<origfoot n="'+n+'" t="'+escapeQuote(t)+'"/>'
    // });

    // content=content.replace(/<note n="([a-z\d]+)" resp="([^<]+)" type="([a-z]+)">([^<]+)<\/note>/g,(m,n,resp,type,t)=>{
    //     return '<'+type+'_note n="'+n+'" resp="'+resp +'" t="'+escapeQuote(t)+'" />';
    // })
    // //有時先出現type
    // content=content.replace(/<note type="([a-z]+)" n="([a-z\d]+)" resp="([^<]+)">([^<]+)<\/note>/g,(m,type,n,resp,t)=>{
    //     return '<'+type+'_note n="'+n+'" resp="'+resp +'" t="'+escapeQuote(t)+'" />';
    // })


    return content;
}
const nullify_app=content=>{
    //lem one wit
    content=content.replace(/<app n="([\da-z]+)"><lem wit="([^<]+)">([^<]*?)<\/lem><rdg resp="([^<]+)" wit="([^<]+)">([^<]*?)<\/rdg><\/app>/g,
    (m,n, lemwit,lem,rdgresp,rdgwit,rdg)=>{
        return '<apprdg n="'+n+'" resp="'+ rdgresp +'" wit="'+lemwit+'" rdgwit="'+rdgwit+'" rdg="'+rdg+'">'+lem+'</apprdg>';
    })

    content=content.replace(/<app type="star" corresp="#(\d+)"><lem wit="([^<]+)">([^<]*?)<\/lem><rdg resp="([^<]+)" wit="([^<]+)">([^<]*?)<\/rdg><\/app>/g,
    (m,corresp, lemwit,lem,rdgresp,rdgwit,rdg)=>{
        return '<appstar corresp="'+corresp+'" resp="'+ rdgresp +'" wit="'+lemwit+'" rdgwit="'+rdgwit+'" rdg="'+rdg+'">'+lem+'</appstar>';
    })

    content=content.replace(/<app n="([\da-z]+)"><lem resp="([^<]+)" wit="([^<]+)">([^<]+)<\/lem><rdg wit="([^<]+)">([^<]*?)<\/rdg><\/app>/g,
    (m,n, lemresp,lemwit,lem,rdgwit,rdg)=>{ 
        let cf='';
        lem=lem.replace(/\[cf(\d+)_([A-Za-z\d_]+)\]/g,(m,n,link)=>{
            cf+=( (parseInt(n)>1)?',':'') + n+'_'+link ;
            return ''
        })
        return '<apprdg n="'+n+'" resp="'+lemresp +'" rdg="'+rdg+'"'
        +(cf?(' cf="'+cf+'"'):"")
        +' wit="'+lemwit+'">'+lem+'</apprdg>';
    })


    //lem multiple wit
    content=content.replace(/<app n="([\da-z]+)"><lem wit="([^<]+)">([^<]+)<\/lem><rdg resp="([^<]+?)" wit="([^<]+)">([^<]*?)<\/rdg><rdg resp="([^<]+)" wit="([^<]+)">([^<]*?)<\/rdg>\<\/app>/g,
    (m,n, lemwit,lem,rdgresp,rdgwit,rdg,rdgresp2,rdgwit2,rdg2)=>{
        return '<apprdgs n="'+n+'" resp="'+ rdgresp +'" wit="'+lemwit+'">'+lem+'</apprdgs>'
    })
    return content;
}
const nullify=content=>{
    content=content.replace(/<g ref="#([\-A-Za-z\d]+)"\/>/g,'[mc_$1]')

    content=content.replace(/<figure><graphic url="([^>]+)"><\/graphic><\/figure>/g,'[fg_$1]')

    content=content.replace(/<space([^>]*?)\/>/g,(m,attrs)=>{
        const {quantity}=parseXMLAttribute(attrs)
        return ' '.repeat(parseInt(quantity))
    })
    content=content.replace(/<unclear><\/unclear>/g,'[??]');

    content=nullify_note(content);
    content=nullify_note(content); //recursive , T14n0443_004.xml 0337016
    content=nullify_app(content);
    content=nullify_note(content);

    return content;
}
const conv=(fn)=>{
    ctx.fn=fn;
    process.stdout.write('\r'+fn+'   ');
    let content=readTextContent(fn);
    content=nullify(content)
    // const at=content.indexOf('<apprdg',100);
    // if (~at) console.log(content.slice(at,at+20));
    // writeChanged( Path.basename(fn),content,true);

    const [txt,tags]=parseXML(content,ctx);
    //convert <note><note> to 

    if (ctx.nested.length) {
        const nestednote=ctx.nested.filter(it=>it[1]=='note')
        if (nestednote.length) {
            console.log(fn,'nestednote',nestednote)
            ctx.nested=[];
        }
    }
    return content;
}
const convAll=()=>{
    files.forEach(fn=>{
        if (!existsSync(rootdir+fn)) return;
        const content=conv(rootdir+fn);
    })
}



convAll();