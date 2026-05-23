/**
 * Seed: Company Watchlist
 *
 * 185 Italian medium/large companies to monitor for internship and stage openings.
 * Large companies = aspirational engagement; medium = accessible opportunities.
 *
 * Run: npx ts-node prisma/seeds/company-watchlist.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const companies: Array<{
  name: string;
  careersUrl: string;
  sector: string;
  tier: 'large' | 'medium';
}> = [
  // --- Moda & Lusso (25) ---
  { name: 'Gucci', careersUrl: 'https://www.gucci.com/it/en/st/careers-landing', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Prada Group', careersUrl: 'https://www.pradagroup.com/en/careers.html', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Giorgio Armani', careersUrl: 'https://www.armani.com/en/careers', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Versace', careersUrl: 'https://www.versace.com/en-us/careers/', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Valentino', careersUrl: 'https://www.valentino.com/en/careers', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Fendi', careersUrl: 'https://www.fendi.com/en/careers', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Moncler', careersUrl: 'https://www.monclergroup.com/en/careers', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Bulgari', careersUrl: 'https://www.bulgari.com/en-it/careers.html', sector: 'Moda & Lusso', tier: 'large' },
  { name: 'Salvatore Ferragamo', careersUrl: 'https://www.ferragamo.com/en-it/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Ermenegildo Zegna', careersUrl: 'https://www.zegnagroup.com/en/careers/', sector: 'Moda & Lusso', tier: 'medium' },
  { name: "Tod's Group", careersUrl: 'https://www.todsgroup.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'OTB Group', careersUrl: 'https://careers.otbgroup.com/', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Calzedonia Group', careersUrl: 'https://careers.calzedoniagroup.com/', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Max Mara', careersUrl: 'https://www.maxmara.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Furla', careersUrl: 'https://www.furla.com/it/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Pinko', careersUrl: 'https://www.pinko.com/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Liu Jo', careersUrl: 'https://www.liujo.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Golden Goose', careersUrl: 'https://careers.goldengoose.com/', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Brunello Cucinelli', careersUrl: 'https://www.brunellocucinelli.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Etro', careersUrl: 'https://www.etro.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Marni', careersUrl: 'https://www.marni.com/en-it/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Replay', careersUrl: 'https://www.fashionbox.com/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Patrizia Pepe', careersUrl: 'https://www.patriziapepe.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Kiton', careersUrl: 'https://www.kiton.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },
  { name: 'Stefanel', careersUrl: 'https://www.stefanel.com/en/careers', sector: 'Moda & Lusso', tier: 'medium' },

  // --- Food & Beverage (20) ---
  { name: 'Barilla Group', careersUrl: 'https://jobs.barillagroup.com/', sector: 'Food & Beverage', tier: 'large' },
  { name: 'Ferrero', careersUrl: 'https://www.ferrerocareers.com/', sector: 'Food & Beverage', tier: 'large' },
  { name: 'Lavazza', careersUrl: 'https://careers.lavazza.com/', sector: 'Food & Beverage', tier: 'large' },
  { name: 'Campari Group', careersUrl: 'https://careers.camparigroup.com/', sector: 'Food & Beverage', tier: 'large' },
  { name: 'Cremonini Group', careersUrl: 'https://www.cremonini.com/lavora-con-noi/', sector: 'Food & Beverage', tier: 'large' },
  { name: 'Giovanni Rana', careersUrl: 'https://www.giovannirana.com/lavora-con-noi', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Mutti', careersUrl: 'https://www.mutti-parma.com/it/lavora-con-noi', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Illy Caffè', careersUrl: 'https://www.illy.com/it-it/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'De Cecco', careersUrl: 'https://www.dececco.com/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Surgital', careersUrl: 'https://www.surgital.it/lavora-con-noi', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Amadori', careersUrl: 'https://www.amadori.it/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Granarolo', careersUrl: 'https://www.granarolo.it/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Caffè Borbone', careersUrl: 'https://www.caffeborbone.com/lavora-con-noi', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Sanpellegrino', careersUrl: 'https://www.sanpellegrino.com/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Acetum', careersUrl: 'https://www.acetum.it/lavora-con-noi', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Conserve Italia', careersUrl: 'https://www.conserveitalia.it/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Eataly', careersUrl: 'https://www.eataly.com/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Sammontana', careersUrl: 'https://www.sammontana.it/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Zuegg', careersUrl: 'https://www.zuegg.com/careers', sector: 'Food & Beverage', tier: 'medium' },
  { name: 'Rana', careersUrl: 'https://www.giovannirana.it/careers', sector: 'Food & Beverage', tier: 'medium' },

  // --- Tech & Consulting (25) ---
  { name: 'Reply', careersUrl: 'https://www.reply.com/en/careers', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'Engineering Group', careersUrl: 'https://careers.eng.it/', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'Accenture Italy', careersUrl: 'https://www.accenture.com/it-it/careers', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'NTT Data Italy', careersUrl: 'https://it.nttdata.com/careers', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'Capgemini Italy', careersUrl: 'https://www.capgemini.com/it-it/careers/', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'Deloitte Italy', careersUrl: 'https://www2.deloitte.com/it/it/careers.html', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'EY Italy', careersUrl: 'https://www.ey.com/it_it/careers', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'KPMG Italy', careersUrl: 'https://home.kpmg/it/it/home/careers.html', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'PwC Italy', careersUrl: 'https://www.pwc.com/it/it/careers.html', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'IBM Italy', careersUrl: 'https://www.ibm.com/it-it/employment/', sector: 'Tech & Consulting', tier: 'large' },
  { name: 'Bending Spoons', careersUrl: 'https://jobs.bendingspoons.com/', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Satispay', careersUrl: 'https://jobs.satispay.com/', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Scalapay', careersUrl: 'https://www.scalapay.com/en/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Musixmatch', careersUrl: 'https://musixmatch.com/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Prima Assicurazioni', careersUrl: 'https://careers.prima.it/', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Facile.it', careersUrl: 'https://careers.facile.it/', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Talent Garden', careersUrl: 'https://talentgarden.com/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Jakala', careersUrl: 'https://jakala.com/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Almaviva', careersUrl: 'https://www.almaviva.it/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Lutech', careersUrl: 'https://www.lutech.group/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Var Group', careersUrl: 'https://www.vargroup.com/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'TeamSystem', careersUrl: 'https://www.teamsystem.com/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Exprivia', careersUrl: 'https://www.exprivia.com/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'InfoCert', careersUrl: 'https://www.infocert.it/careers', sector: 'Tech & Consulting', tier: 'medium' },
  { name: 'Relatech', careersUrl: 'https://www.relatech.com/careers', sector: 'Tech & Consulting', tier: 'medium' },

  // --- Energia & Utilities (15) ---
  { name: 'ENI', careersUrl: 'https://eni.com/en-IT/careers.html', sector: 'Energia & Utilities', tier: 'large' },
  { name: 'Enel', careersUrl: 'https://corporate.enel.it/en/careers', sector: 'Energia & Utilities', tier: 'large' },
  { name: 'Edison', careersUrl: 'https://www.edison.it/en/careers', sector: 'Energia & Utilities', tier: 'large' },
  { name: 'Snam', careersUrl: 'https://careers.snam.com/', sector: 'Energia & Utilities', tier: 'large' },
  { name: 'Terna', careersUrl: 'https://careers.terna.it/', sector: 'Energia & Utilities', tier: 'large' },
  { name: 'A2A', careersUrl: 'https://careers.a2a.eu/', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Hera Group', careersUrl: 'https://careers.gruppohera.it/', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Iren', careersUrl: 'https://careers.gruppoiren.it/', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'ERG', careersUrl: 'https://www.erg.eu/careers', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Italgas', careersUrl: 'https://careers.italgas.it/', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'ACEA', careersUrl: 'https://careers.acea.it/', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Saras', careersUrl: 'https://www.saras.it/careers', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Falck Renewables', careersUrl: 'https://www.falckrenewables.eu/careers', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Alperia', careersUrl: 'https://www.alperia.eu/careers', sector: 'Energia & Utilities', tier: 'medium' },
  { name: 'Dolomiti Energia', careersUrl: 'https://www.dolomiti.it/careers', sector: 'Energia & Utilities', tier: 'medium' },

  // --- Banking, Finance & Assicurazioni (20) ---
  { name: 'Intesa Sanpaolo', careersUrl: 'https://careers.intesasanpaolo.com/', sector: 'Banking & Finance', tier: 'large' },
  { name: 'UniCredit', careersUrl: 'https://careers.unicredit.eu/', sector: 'Banking & Finance', tier: 'large' },
  { name: 'Generali', careersUrl: 'https://www.generali.com/careers', sector: 'Banking & Finance', tier: 'large' },
  { name: 'Poste Italiane', careersUrl: 'https://www.posteitaliane.it/careers', sector: 'Banking & Finance', tier: 'large' },
  { name: 'Mediobanca', careersUrl: 'https://www.mediobanca.com/careers', sector: 'Banking & Finance', tier: 'large' },
  { name: 'Cassa Depositi e Prestiti', careersUrl: 'https://careers.cdp.it/', sector: 'Banking & Finance', tier: 'large' },
  { name: 'FinecoBank', careersUrl: 'https://careers.fineco.com/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'BNL', careersUrl: 'https://careers.bnl.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Banco BPM', careersUrl: 'https://careers.bancobpm.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Nexi', careersUrl: 'https://careers.nexigroup.com/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Azimut', careersUrl: 'https://careers.azimut.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Banca Mediolanum', careersUrl: 'https://careers.bancamediolanum.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Unipol', careersUrl: 'https://careers.unipol.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Allianz Italy', careersUrl: 'https://careers.allianz.com/it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'AXA Italy', careersUrl: 'https://careers.axa.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Zurich Italy', careersUrl: 'https://careers.zurich.com/it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Credem', careersUrl: 'https://careers.credem.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Banca Sella', careersUrl: 'https://careers.sella.it/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'doValue', careersUrl: 'https://careers.dovalue.com/', sector: 'Banking & Finance', tier: 'medium' },
  { name: 'Cattolica Assicurazioni', careersUrl: 'https://careers.cattolica.it/', sector: 'Banking & Finance', tier: 'medium' },

  // --- Pharma & Healthcare (15) ---
  { name: 'Menarini Group', careersUrl: 'https://careers.menarini.com/', sector: 'Pharma & Healthcare', tier: 'large' },
  { name: 'Recordati', careersUrl: 'https://careers.recordati.com/', sector: 'Pharma & Healthcare', tier: 'large' },
  { name: 'Chiesi Farmaceutici', careersUrl: 'https://careers.chiesi.com/', sector: 'Pharma & Healthcare', tier: 'large' },
  { name: 'Angelini Pharma', careersUrl: 'https://careers.angelinipharma.com/', sector: 'Pharma & Healthcare', tier: 'large' },
  { name: 'Bracco', careersUrl: 'https://careers.bracco.com/', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Dompé', careersUrl: 'https://careers.dompe.com/', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Zambon', careersUrl: 'https://careers.zambon.com/', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Alfasigma', careersUrl: 'https://careers.alfasigma.com/', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Italfarmaco', careersUrl: 'https://www.italfarmaco.com/careers', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Sifi', careersUrl: 'https://www.sifi.it/careers', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Biofarma', careersUrl: 'https://www.biofarma.it/careers', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Kedrion', careersUrl: 'https://careers.kedrion.com/', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Nerviano Medical Sciences', careersUrl: 'https://careers.nervianoms.com/', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'Polifarma', careersUrl: 'https://www.polifarma.it/careers', sector: 'Pharma & Healthcare', tier: 'medium' },
  { name: 'GVM Care & Research', careersUrl: 'https://careers.gvmnet.it/', sector: 'Pharma & Healthcare', tier: 'medium' },

  // --- Automotive & Manifatturiero (15) ---
  { name: 'Ferrari', careersUrl: 'https://careers.ferrari.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Lamborghini', careersUrl: 'https://careers.lamborghini.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Ducati', careersUrl: 'https://careers.ducati.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Brembo', careersUrl: 'https://careers.brembo.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Fincantieri', careersUrl: 'https://careers.fincantieri.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Pirelli', careersUrl: 'https://careers.pirelli.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Saipem', careersUrl: 'https://careers.saipem.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Webuild', careersUrl: 'https://careers.webuild.com/', sector: 'Automotive & Manifatturiero', tier: 'large' },
  { name: 'Pininfarina', careersUrl: 'https://careers.pininfarina.com/', sector: 'Automotive & Manifatturiero', tier: 'medium' },
  { name: 'Interpump Group', careersUrl: 'https://careers.interpump.it/', sector: 'Automotive & Manifatturiero', tier: 'medium' },
  { name: 'IMA Group', careersUrl: 'https://careers.ima.it/', sector: 'Automotive & Manifatturiero', tier: 'medium' },
  { name: 'Datalogic', careersUrl: 'https://careers.datalogic.com/', sector: 'Automotive & Manifatturiero', tier: 'medium' },
  { name: 'SCM Group', careersUrl: 'https://careers.scmgroup.com/', sector: 'Automotive & Manifatturiero', tier: 'medium' },
  { name: 'Ariston Group', careersUrl: 'https://careers.aristongroup.com/', sector: 'Automotive & Manifatturiero', tier: 'medium' },
  { name: "De'Longhi Group", careersUrl: 'https://careers.delonghigroup.com/', sector: 'Automotive & Manifatturiero', tier: 'medium' },

  // --- Retail & Ecommerce (15) ---
  { name: 'Esselunga', careersUrl: 'https://careers.esselunga.it/', sector: 'Retail & Ecommerce', tier: 'large' },
  { name: 'YOOX Net-A-Porter', careersUrl: 'https://careers.ynap.com/', sector: 'Retail & Ecommerce', tier: 'large' },
  { name: 'Autogrill', careersUrl: 'https://careers.autogrill.com/', sector: 'Retail & Ecommerce', tier: 'large' },
  { name: 'Amplifon', careersUrl: 'https://careers.amplifon.com/', sector: 'Retail & Ecommerce', tier: 'large' },
  { name: 'Subito.it', careersUrl: 'https://careers.subito.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Idealista Italy', careersUrl: 'https://careers.idealista.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Immobiliare.it', careersUrl: 'https://careers.immobiliare.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Doctolib Italy', careersUrl: 'https://careers.doctolib.fr/it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Leroy Merlin Italy', careersUrl: 'https://careers.leroymerlin.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Decathlon Italy', careersUrl: 'https://careers.decathlon.com/it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'OVS', careersUrl: 'https://careers.ovs.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Unieuro', careersUrl: 'https://careers.unieuro.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Pittarosso', careersUrl: 'https://careers.pittarosso.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Euronics Italy', careersUrl: 'https://careers.euronics.it/', sector: 'Retail & Ecommerce', tier: 'medium' },
  { name: 'Tigotà', careersUrl: 'https://careers.tigota.it/', sector: 'Retail & Ecommerce', tier: 'medium' },

  // --- Media & Sport (15) ---
  { name: 'RAI', careersUrl: 'https://www.rai.it/lavora-con-noi/', sector: 'Media & Sport', tier: 'large' },
  { name: 'Mediaset', careersUrl: 'https://careers.mediaset.it/', sector: 'Media & Sport', tier: 'large' },
  { name: 'Sky Italia', careersUrl: 'https://careers.sky.it/', sector: 'Media & Sport', tier: 'large' },
  { name: 'Mondadori', careersUrl: 'https://careers.mondadori.com/', sector: 'Media & Sport', tier: 'large' },
  { name: 'RCS MediaGroup', careersUrl: 'https://careers.rcsmediagroup.it/', sector: 'Media & Sport', tier: 'large' },
  { name: 'GEDI', careersUrl: 'https://careers.gedi.it/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'Il Sole 24 Ore', careersUrl: 'https://careers.ilsole24ore.com/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'Juventus', careersUrl: 'https://careers.juventus.com/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'FC Internazionale', careersUrl: 'https://careers.inter.it/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'AC Milan', careersUrl: 'https://careers.acmilan.com/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'AS Roma', careersUrl: 'https://careers.asroma.it/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'Condé Nast Italy', careersUrl: 'https://careers.condenast.com/it/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'Hearst Italy', careersUrl: 'https://careers.hearst.it/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'Discovery Italy', careersUrl: 'https://careers.discovery.com/it/', sector: 'Media & Sport', tier: 'medium' },
  { name: 'Cairo Communication', careersUrl: 'https://careers.cairo.it/', sector: 'Media & Sport', tier: 'medium' },

  // --- Infrastrutture, Difesa & Altro (15) ---
  { name: 'Leonardo', careersUrl: 'https://careers.leonardo.com/', sector: 'Infrastrutture & Difesa', tier: 'large' },
  { name: 'TIM', careersUrl: 'https://careers.tim.it/', sector: 'Infrastrutture & Difesa', tier: 'large' },
  { name: 'Ferrovie dello Stato', careersUrl: 'https://careers.fsgrouppeople.com/', sector: 'Infrastrutture & Difesa', tier: 'large' },
  { name: 'Autostrade per l\'Italia', careersUrl: 'https://careers.autostrade.it/', sector: 'Infrastrutture & Difesa', tier: 'large' },
  { name: 'Stellantis Italy', careersUrl: 'https://careers.stellantis.com/it/', sector: 'Infrastrutture & Difesa', tier: 'large' },
  { name: 'Prysmian', careersUrl: 'https://careers.prysmiangroup.com/', sector: 'Infrastrutture & Difesa', tier: 'large' },
  { name: 'ITA Airways', careersUrl: 'https://careers.ita-airways.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Italo-NTV', careersUrl: 'https://careers.italotreno.it/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Costa Crociere', careersUrl: 'https://careers.costacruises.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'MSC Crociere', careersUrl: 'https://careers.msc.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Fiera Milano', careersUrl: 'https://careers.fieramilano.it/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Maire Tecnimont', careersUrl: 'https://careers.mairetecnimont.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Danieli', careersUrl: 'https://careers.danieli.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Tenaris', careersUrl: 'https://careers.tenaris.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
  { name: 'Alpitour', careersUrl: 'https://careers.alpitourworld.com/', sector: 'Infrastrutture & Difesa', tier: 'medium' },
];

async function main() {
  console.log(`Seeding ${companies.length} companies into CompanyWatchlist...`);

  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const result = await prisma.companyWatchlist.upsert({
      where: { careersUrl: company.careersUrl },
      update: {
        name: company.name,
        sector: company.sector,
        tier: company.tier,
      },
      create: {
        name: company.name,
        careersUrl: company.careersUrl,
        sector: company.sector,
        tier: company.tier,
        isActive: true,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`Done: ${created} created, ${skipped} already existed (updated).`);
  console.log(`Total in DB: ${await prisma.companyWatchlist.count()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
