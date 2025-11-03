import csv
import json
from pathlib import Path

# Token mapping from Supabase
TOKEN_MAP = {
    "4155701091": "b3cdodcr9o8z",
    "ADACHIANG@GMAIL.COM": "vjhkpwbysxc2",
    "ADESINATENI@YAHOO.COM": "jy4nbo6jleum",
    "alex@amorrison.email": "nnrhrmzfz1wy",
    "AMBERLILLIE69@YAHOO.COM": "2ngf5xc34yqo",
    "AMP_COONEY@YAHOO.COM": "1j7v7nf4yj6k",
    "ANGELOJCOSTANZO@YAHOO.COM": "u0mhqd0ukybr",
    "ARJIMENEZ0504@GMAIL.COM": "t3brsmzp4pm8",
    "AUNEEK@GMAIL.COM": "7sfwbpn8ebk1",
    "AURELIOMERCADO19@GMAIL.COM": "oebeblttj4pt",
    "AWONG5594@GMAIL.COM": "cuexqepd4ulk",
    "B4REAL7396@SBCGLOBAL.NET": "m16btc28l30e",
    "BDOITEL@GMAIL.COM": "fvjzd22stcv0",
    "BEACHDOGGIE@HOTMAIL.COM": "41nco75i1eyc",
    "BERRYVIVIAN2@GMAIL.COM": "epsu0muz8mhw",
    "BIGWALK827@GMAIL.COM": "xo9isj1wrfdx",
    "BLESSEDIAM7@YAHOO.COM": "qwls2joiqaqf",
    "BMYCOO@HOTMAIL.COM": "72435598ejwj",
    "BNOVAKMCSWEENEY@GMAIL.COM": "bohpsga9agln",
    "BPAMELA1@YAHOO.COM": "7mpnymegicg7",
    "BREEZE929@AOL.COM": "av22wz0ppr4f",
    "BUDDYDAVIS704@GMAIL.COM": "gncdhaowu6r0",
    "BURBANKHAL@YAHOO.COM": "0ffwyr722b12",
    "CANQINN@GMAIL.COM": "yaenuim0i2kr",
    "CEELA44@GMAIL.COM": "qejpnn84c15a",
    "CHALYSALCEDO@GMAIL.COM": "n080p0fqw5q4",
    "CHARMT@MSN.COM": "a3njh57gj7g3",
    "CHECKMAIL531@GMAIL.COM": "0cxt24n3m3ay",
    "CHIPBGOLDSTEIN@GMAIL.COM": "y4ahpuuaxmaa",
    "CHUN.CHAN69@YAHOO.COM": "2lixywnp941e",
    "CLAUDIACALIGAL@AOL.COM": "sapkavs40waw",
    "CROSSREFERENCER@AOL.COM": "w2zu3lqnz9d4",
    "DANIELJMILLER@SBCGLOBAL.NET": "z8ypw5eir5hk",
    "DAVIDTORTURADOR@GMAIL.COM": "842slmkzs619",
    "DEMIG23@AOL.COM": "l9j2frav52wn",
    "DEVINA_6@HOTMAIL.COM": "qkdak0957tnq",
    "DGIBSON021@GMAIL.COM": "fd6fs68p9tu0",
    "DHENNY@MSN.COM": "y4ql3umcd5su",
    "DHTANG9988@AOL.COM": "201rt6va7uco",
    "DIM71383@GMAIL.COM": "pe83b7odhg5c",
    "DIMARDESIGN@YAHOO.COM": "464le9h1i1vf",
    "DKNIGHT003@GMAIL.COM": "8lcg6rq0286c",
    "DONHELLWIG@SBCGLOBAL.NET": "gqpwg9pfzwej",
    "DOUGWNOLAN@GMAIL.COM": "058e4u5zh4jv",
    "DRSUSAN@STANFORD.EDU": "p9o1nkjej0zz",
    "EDDIEBINGHAM57@GMAIL.COM": "uz47bc3v31ce",
    "EDYESED@GMAIL.COM": "djvz92zlot8m",
    "ELANARON@YAHOO.COM": "eqcksda4363c",
    "EMOSTREL@GMAIL.COM": "icipdbclje3c",
    "EUGENEONG3247@GMAIL.COM": "0uxn1ejwx5x8",
    "FATFREE13@YAHOO.COM": "rvq6bbzu05rf",
    "GDLIVIN344@NETSCAPE.NET": "hi011u4fkul1",
    "GELIZ@MSN.COM": "2pw5kvftz3ah",
    "GLENN_MONTEZ@YAHOO.COM": "lqj5nsyk6xwp",
    "GLENNW1103@COMCAST.NET": "iuxilr7fzi8k",
    "GRAYTHANG@HOTMAIL.COM": "5np7ivudkjzm",
    "HANNAHFAITHBENNETT@GMAIL.COM": "zeh2ev8l3evn",
    "HARVEY19511@YAHOO.COM": "ojthvoh0ffbi",
    "HEATHERTARLETON@GMAIL.COM": "zjjwfpjfic7i",
    "HJGERSH@HOTMAIL.COM": "7cdxz4fv3pkt",
    "HSMITH830@SBCGLOBAL.NET": "ilbiq3889l86",
    "HSUALEXANDRA@GMAIL.COM": "inthlp6ninxg",
    "IAALONSO@YAHOO.COM": "8xm108vldv2m",
    "JAMESMORRONE@GMAIL.COM": "i55tc2hgd48v",
    "JAMIEBGIBSON@YAHOO.COM": "0t3ej83ojhi6",
    "JDKIESEL@ATT.NET": "lee7va2n3qq2",
    "JNDBOW@PACBELL.NET": "mk6qbv2xz1o2",
    "JODITOPITZ@GMAIL.COM": "plj3bfc29xyh",
    "JOSHDOGG44@AOL.COM": "ruzjvpxaj9tr",
    "JU94015@YAHOO.COM": "trwgeu4ssgpe",
    "JUANAQUILES@YAHOO.COM": "htfy9ckowmau",
    "KCZEGENI@GMAIL.COM": "366cwdy2aysd",
    "KENNETH_D_CRAMER@YAHOO.COM": "odliq6t2r935",
    "KWRIGHT826@YAHOO.COM": "fn3z84yoma34",
    "LADYKING723@YAHOO.COM": "bgidq9l4hbhw",
    "LARUEJACOB3@HOTMAIL.COM": "f4fc1rkdx9h3",
    "LAUREN122616@AOL.COM": "3bd4rzoyziu3",
    "LIILNENA.ANA@GMAIL.COM": "xkx8054jry58",
    "LILYLAO0@GMAIL.COM": "pvk9321ob93s",
    "LIZMARINADAVID@GMAIL.COM": "vetps8c6tj30",
    "LYOUNGBLOOD@BELLSOUTH.NET": "7j8mu9p2m8zz",
    "MANELA337@HOTMAIL.COM": "8n994aj25wwm",
    "MARIAHIJAR7@GMAIL.COM": "b9dx0y67j2ye",
    "MGAJLOUNY@GMAIL.COM": "gyyfj6htd1dq",
    "MICHAELMISERLIAN@GMAIL.COM": "uqhy2bjcatxs",
    "MRLAU2018@GMAIL.COM": "yrla5j5xi7bv",
    "MUSTANGSONIAGT@YAHOO.COM": "cznt2igfu4sc",
    "MYREATTA@YAHOO.COM": "3a5gmort61u0",
    "NICOLECASEY@NETZERO.NET": "00xe04lbfv2v",
    "PATTYCHIA@GMAIL.COM": "x9f62zve3h9p",
    "PBERGKVIST@GMAIL.COM": "u7voru9mj7ej",
    "PETERTOURNAS@YAHOO.COM": "m4my7lxm40ky",
    "PKELLY@WESTERNALLIED.COM": "ob8ds04jvi10",
    "RANDYHARRIS4402@GMAIL.COM": "fr6xfjot98ox",
    "ROBERT93349@GMAIL.COM": "0blfsonal3q8",
    "RRCERT4RM@MSN.COM": "t25n53yg8gjd",
    "RUTH_SEUNG@YAHOO.COM": "3v2mhhdm1ovc",
    "RUTH-BROOKS@ATT.NET": "gp3akq1kc9ty",
    "SALONBLU@SBCGLOBAL.NET": "nn4ksxugy2kz",
    "SBZUCKER@HOTMAIL.COM": "5r0n998kgpnb",
    "SK8LVR22@MSN.COM": "n5ggdjgp12lz",
    "SLWFONG@HOTMAIL.COM": "m5qs50fgpw5l",
    "SRHNSF@GMAIL.COM": "eklnqzi8ubzo",
    "SSOHAL88@GMAIL.COM": "oal2adi5t6jk",
    "SUMMITTIG@MSN.COM": "74hh036eke5w",
    "TASTEETIFFANY2@AOL.COM": "oj8pl7engu1q",
    "TAUSHAHUNZEKER@HOTMAIL.COM": "imozw8fnjrl0",
    "TDUFORE@GOOGLE.COM": "kz1hgaecs8lf",
    "TEFERIABEBE@AOL.COM": "wyuxtyhafqpd",
    "TERESASCROGGINS20@GMAIL.COM": "ttxolj4s4ets",
    "TLCHAU37@YAHOO.COM": "wev4lc6fxbm7",
    "TODDAMORDE@NETZERO.NET": "p6oz5rqybpup",
    "WESLEY.WILLIAMSON@NGC.COM": "h6rqb4942jbd"
}

def update_csv_with_tokens(input_path, output_path):
    """Update CSV file with calculator tokens from Supabase"""
    rows_updated = 0
    rows_no_token = 0
    
    with open(input_path, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        fieldnames = list(reader.fieldnames)
        
        # Add calculator_token column if it doesn't exist
        # Insert it after property_value
        if 'calculator_token' not in fieldnames:
            if 'property_value' in fieldnames:
                insert_idx = fieldnames.index('property_value') + 1
                fieldnames.insert(insert_idx, 'calculator_token')
            else:
                # Fallback: add at the end
                fieldnames.append('calculator_token')
        
        rows = []
        for row in reader:
            email = row['Email'].strip().upper()
            
            # Look up token from our map
            if email in TOKEN_MAP:
                row['calculator_token'] = TOKEN_MAP[email]
                rows_updated += 1
            else:
                # Keep existing value or leave empty
                if not row.get('calculator_token'):
                    row['calculator_token'] = ''
                    rows_no_token += 1
            
            rows.append(row)
    
    # Write updated CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✓ {input_path.name}")
    print(f"  - Updated: {rows_updated} rows")
    print(f"  - No token found: {rows_no_token} rows")
    print(f"  - Output: {output_path}")
    print()

def main():
    base_dir = Path("11.2.25 leads  to xref")
    
    # Process all 3 CSV files
    csv_files = [
        "number 1.csv",
        "number 2.csv",
        "number 3.csv"
    ]
    
    print("Adding calculator tokens to CSV files...\n")
    
    for csv_file in csv_files:
        input_path = base_dir / csv_file
        output_path = base_dir / csv_file  # Overwrite the original
        
        if input_path.exists():
            update_csv_with_tokens(input_path, output_path)
        else:
            print(f"Warning: {input_path} not found, skipping...")
    
    print("✅ All CSV files updated successfully!")
    print("\nYou can now upload these files to Instantly.")

if __name__ == "__main__":
    main()

