import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Employee {

  empId: string;

  name: string;

  department: string;

  gender: string;

  doj: string;

  company: string;

  totalWorkedDays: number;

  totalPayableWorkedDays: number;

  extraTrainingHour: number;

  extraTrainingHourRate: number;

  extraTrgHrAmount: number;

  grossStipendRate: number;

  earningBasic: number;

  travelingAllowance: number;

  arrear: number;

  earningGrossStipend: number;

  deductionAmount: number;

  fee: number;

  payableBill: number;

  bankAccountNo: string;

  ifsc: string;
}

@Component({
  selector: 'app-salary-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary.html',
  styleUrls: ['./salary.css']
})

export class SalarySheetComponent implements OnInit {

  monthName: string = 'April';

  year: number = 2026;

  private STORAGE_KEY = 'salary_sheet_data';

  employees: Employee[] = [];

  salarySnapshots = [
    {
      title: 'Gross Salary',
      value: '₹ 0',
      icon: 'payments',
      color: 'blue',
      change: '4.5%',
      isUp: true,
      subtitle: 'vs last month'
    },

    {
      title: 'Total Deductions',
      value: '₹ 0',
      icon: 'money_off',
      color: 'green',
      change: '1.2%',
      isUp: false,
      subtitle: 'vs last month'
    },

    {
      title: 'Net Payable',
      value: '₹ 0',
      icon: 'account_balance_wallet',
      color: 'orange',
      change: '3.8%',
      isUp: true,
      subtitle: 'vs last month'
    },

    {
      title: 'Processed Staff',
      value: '0',
      icon: 'assignment_turned_in',
      color: 'purple',
      change: '0%',
      isUp: true,
      subtitle: 'Current Month'
    }
  ];

  ngOnInit(): void {

    this.loadData();

    this.updateSnapshots();
  }

  /* 
     LOAD DATA
 */
  loadData(): void {

    const savedData =
      localStorage.getItem(this.STORAGE_KEY);

    if (savedData) {

      this.employees = JSON.parse(savedData);

    } else {

      for (let i = 0; i < 20; i++) {

        this.addRow();
      }
    }
  }

  /* 
     SAVE DATA
   */
  saveData(): void {

    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(this.employees)
    );

    this.updateSnapshots();
  }

  /* 
     ADD ROW
 */
  addRow(): void {

    this.employees.push({

      empId: '',

      name: '',

      department: '',

      gender: '',

      doj: '',

      company: '',

      totalWorkedDays: 30,

      totalPayableWorkedDays: 0,

      extraTrainingHour: 0,

      extraTrainingHourRate: 57,

      extraTrgHrAmount: 0,

      grossStipendRate: 0,

      earningBasic: 0,

      travelingAllowance: 0,

      arrear: 0,

      earningGrossStipend: 0,

      deductionAmount: 0,

      fee: 0,

      payableBill: 0,

      bankAccountNo: '',

      ifsc: ''
    });

    this.saveData();
  }

  /* 
     CALCULATE VALUES
  */
  calculate(emp: Employee): void {

    emp.extraTrgHrAmount =

      (emp.extraTrainingHour || 0) *

      (emp.extraTrainingHourRate || 0);

    if (emp.totalWorkedDays > 0) {

      emp.earningBasic = Math.round(

        (
          (emp.grossStipendRate || 0) /

          emp.totalWorkedDays
        ) *

        (emp.totalPayableWorkedDays || 0)
      );
    }

    emp.earningGrossStipend =

      emp.earningBasic +

      emp.extraTrgHrAmount +

      (emp.travelingAllowance || 0) +

      (emp.arrear || 0);

    emp.payableBill =

      emp.earningGrossStipend -

      (emp.deductionAmount || 0) -

      (emp.fee || 0);

    this.saveData();
  }

  /* 
     UPDATE SNAPSHOTS
   */
  updateSnapshots(): void {

    const grossSalary = this.employees.reduce(

      (sum, emp) =>

        sum + (emp.earningGrossStipend || 0),

      0
    );

    const totalDeductions = this.employees.reduce(

      (sum, emp) =>

        sum +

        (emp.deductionAmount || 0) +

        (emp.fee || 0),

      0
    );

    const netPayable = this.employees.reduce(

      (sum, emp) =>

        sum + (emp.payableBill || 0),

      0
    );

    const processedStaff = this.employees.filter(

      emp => emp.name.trim() !== ''

    ).length;

    this.salarySnapshots = [

      {
        title: 'Gross Salary',
        value: `₹ ${grossSalary.toLocaleString()}`,
        icon: 'payments',
        color: 'blue',
        change: '4.5%',
        isUp: true,
        subtitle: 'vs last month'
      },

      {
        title: 'Total Deductions',
        value: `₹ ${totalDeductions.toLocaleString()}`,
        icon: 'money_off',
        color: 'green',
        change: '1.2%',
        isUp: false,
        subtitle: 'vs last month'
      },

      {
        title: 'Net Payable',
        value: `₹ ${netPayable.toLocaleString()}`,
        icon: 'account_balance_wallet',
        color: 'orange',
        change: '3.8%',
        isUp: true,
        subtitle: 'vs last month'
      },

      {
        title: 'Processed Staff',
        value: processedStaff.toString(),
        icon: 'assignment_turned_in',
        color: 'purple',
        change: '0%',
        isUp: true,
        subtitle: 'Current Month'
      }
    ];
  }

  /* 
     DELETE ROW
   */
  deleteRow(index: number): void {

    this.employees.splice(index, 1);

    this.saveData();
  }

  /* 
     CLEAR ALL
   */
  clearAll(): void {

    const confirmDelete = confirm(
      'Are you sure you want to clear all data?'
    );

    if (!confirmDelete) {

      return;
    }

    localStorage.removeItem(this.STORAGE_KEY);

    this.employees = [];

    for (let i = 0; i < 20; i++) {

      this.addRow();
    }

    this.updateSnapshots();
  }
}
